import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { toAmount } from "@/lib/utils" // CHANGED: NaN-proof money coercion
import { billTotals } from "@/lib/billTotals" // CHANGED: one implementation of the bill arithmetic
import { withAuth } from "@/lib/withAuth" // CHANGED: replaces the repeated auth/user-lookup/403/try-catch preamble
import { paymentStatusOf, balanceOf, billedSharesOf } from "@/lib/paymentStatus" // CHANGED: bill status is derived from money, never stored

type Ctx = { params: { billId: string } }

// CHANGED: withAuth resolves the session, loads the user, derives effectiveUserId
// and — via { ownerOnly: true } — returns the 403 that each handler used to write
// by hand. Staff access is unchanged; it is now declared rather than remembered.

// GET - Fetch single bill
export const GET = withAuth<Ctx>(async (_req, { effectiveUserId }, { params }) => {
    // CHANGED: only return this bill if it actually belongs to the requesting business
    const bill = await prisma.bill.findFirst({
      where: { id: params.billId, userId: effectiveUserId },
      include: {
        items: true
      }
    })

    if (!bill) {
      return NextResponse.json({ success: false, error: "Bill not found" }, { status: 404 })
    }

    // CHANGED: return the EVENTS this bill covers, earliest first, each with what it
    // still owes. The record-payment dialog needs exactly this to propose a waterfall
    // split, and BillItem.eventId — the link that has always been written but never read
    // back — is what makes it available without a new table.
    const eventIds = Array.from(new Set(
      bill.items.map(i => i.eventId).filter((id): id is string => !!id)
    ))

    const events = eventIds.length
      ? await prisma.event.findMany({
          where: { id: { in: eventIds }, userId: effectiveUserId },
          select: {
            id: true, eventId: true, organizerName: true, location: true,
            functionDate: true, totalAmount: true, advancePayment: true
          },
          orderBy: { functionDate: "asc" }
        })
      : []

    // Paid = what the bill's events have received. Advances taken before the bill
    // existed and payments recorded against the bill are the same rows, so this is the
    // whole story with nothing double-counted.
    const paid = events.reduce((sum, e) => sum + (e.advancePayment || 0), 0)

    const payments = await prisma.advancePayment.findMany({
      where: { billId: bill.id },
      orderBy: { paidDate: "asc" }
    })

    // CHANGED: each event owes its share of THIS bill's total — after discount and tax —
    // not its original quote. The record-payment waterfall fills these balances, so
    // without this a discounted bill could never be filled to zero.
    const shares = billedSharesOf(bill.totalAmount, bill.items)

    return NextResponse.json({
      success: true,
      data: {
        ...bill,
        paidAmount: paid,
        status: paymentStatusOf(paid, bill.totalAmount),
        balance: balanceOf(paid, bill.totalAmount),
        events: events.map(e => {
          const receivable = shares.get(e.id) ?? e.totalAmount
          return {
            ...e,
            receivable,
            balance: balanceOf(e.advancePayment || 0, receivable)
          }
        }),
        payments
      }
    })
}, { ownerOnly: true })

// PUT - Update bill (status, payment, or full edit)
export const PUT = withAuth<Ctx>(async (req: NextRequest, { effectiveUserId }, { params }) => {
    const body = await req.json()
    const { 
      updateItems,
      customerName,
      phoneNumber,
      address,
      clientGstNo,
      items,
      discountType,
      discountValue,
      sgst,
      cgst,
      notes
    } = body

    // CHANGED: only touch this bill if it actually belongs to the requesting business
    const bill = await prisma.bill.findFirst({
      where: { id: params.billId, userId: effectiveUserId }
    })

    if (!bill) {
      return NextResponse.json({ success: false, error: "Bill not found" }, { status: 404 })
    }

    // Full bill update with items
    if (updateItems && items) {
      // CHANGED: shared with POST /api/bills and the composer's summary panel — see
      // lib/billTotals.ts. This was a third copy of the same four lines of arithmetic.
      const { subtotal, discountAmount, totalAmount } =
        billTotals({ items, discountType, discountValue, sgst, cgst })

      // Delete existing items and create new ones
      await prisma.billItem.deleteMany({
        where: { billId: params.billId }
      })

      const updatedBill = await prisma.bill.update({
        where: { id: params.billId },
        data: {
          customerName,
          phoneNumber,
          address,
          clientGstNo,
          subtotal,
          discountType,
          discountValue: toAmount(discountValue),
          discountAmount,
          sgst: toAmount(sgst),
          cgst: toAmount(cgst),
          totalAmount,
          notes,
          items: {
            create: items.map((item: any) => ({
              description: item.description,
              quantity: toAmount(item.quantity),
              rate: toAmount(item.rate),
              amount: toAmount(item.quantity) * toAmount(item.rate),
              eventId: item.eventId || null
            }))
          }
        },
        include: {
          items: true
        }
      })

      return NextResponse.json({ success: true, data: updatedBill })
    }

    // CHANGED: the status / paidAmount branch is gone. It was what the "Mark Paid" and
    // "Mark Unpaid" buttons called, and it let a click declare a bill settled with no
    // payment behind it — the same two-views-of-one-fact problem as the green-bar bug,
    // one layer up. Payments are rows now: POST /api/bills/[billId]/payments. This PUT
    // only edits the bill DOCUMENT (customer, items, discount, tax, notes).
    return NextResponse.json({
      success: false,
      error: "A bill's paid amount is derived from its payments. Record a payment at /api/bills/[billId]/payments instead of setting status."
    }, { status: 400 })
}, { ownerOnly: true })

// DELETE - Delete bill
export const DELETE = withAuth<Ctx>(async (_req, { effectiveUserId }, { params }) => {
    // CHANGED: confirm this bill actually belongs to the requesting business before deleting it
    const ownedBill = await prisma.bill.findFirst({ where: { id: params.billId, userId: effectiveUserId }, select: { id: true } })
    if (!ownedBill) {
      return NextResponse.json({ success: false, error: "Bill not found" }, { status: 404 })
    }

    await prisma.bill.delete({
      where: { id: params.billId }
    })

    return NextResponse.json({ success: true, message: "Bill deleted" })
}, { ownerOnly: true })

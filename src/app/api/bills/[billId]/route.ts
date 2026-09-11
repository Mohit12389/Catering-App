import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { toAmount } from "@/lib/utils" // CHANGED: NaN-proof money coercion
import { withAuth } from "@/lib/withAuth" // CHANGED: replaces the repeated auth/user-lookup/403/try-catch preamble

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

    return NextResponse.json({ success: true, data: bill })
}, { ownerOnly: true })

// PUT - Update bill (status, payment, or full edit)
export const PUT = withAuth<Ctx>(async (req: NextRequest, { effectiveUserId }, { params }) => {
    const body = await req.json()
    const { 
      status, 
      paidAmount, 
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
      // Calculate amounts
      const subtotal = items.reduce((sum: number, item: any) => sum + (toAmount(item.quantity) * toAmount(item.rate)), 0)
      
      let discountAmount = 0
      if (discountType === "percentage") {
        discountAmount = (subtotal * toAmount(discountValue)) / 100
      } else if (discountType === "fixed") {
        discountAmount = toAmount(discountValue)
      }

      const afterDiscount = subtotal - discountAmount
      const sgstAmount = (afterDiscount * toAmount(sgst)) / 100
      const cgstAmount = (afterDiscount * toAmount(cgst)) / 100
      const totalAmount = afterDiscount + sgstAmount + cgstAmount

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

    // Simple status/payment update
    let newStatus = status
    if (paidAmount !== undefined) {
      const newPaidAmount = paidAmount
      if (newPaidAmount >= bill.totalAmount) {
        newStatus = "paid"
      } else if (newPaidAmount > 0) {
        newStatus = "partial"
      } else {
        newStatus = "unpaid"
      }
    }

    const updatedBill = await prisma.bill.update({
      where: { id: params.billId },
      data: {
        ...(status && { status: newStatus }),
        ...(paidAmount !== undefined && { paidAmount, status: newStatus })
      },
      include: {
        items: true
      }
    })

    return NextResponse.json({ success: true, data: updatedBill })
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

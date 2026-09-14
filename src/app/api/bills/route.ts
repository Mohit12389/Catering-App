import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateBody } from "@/lib/validate"  // CHANGED: request body validation
import { billSchema } from "@/lib/schemas"
import { toAmount } from "@/lib/utils" // CHANGED: NaN-proof money coercion
import { billTotals } from "@/lib/billTotals" // CHANGED: one implementation of the bill arithmetic
import { withAuth } from "@/lib/withAuth" // CHANGED: replaces the repeated auth/user-lookup/403/try-catch preamble
import { paymentStatusOf } from "@/lib/paymentStatus" // CHANGED: bill status is derived from money, never stored

function generateBillNumber() {
  const year = new Date().getFullYear()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `BILL-${year}-${random}`
}

// CHANGED: withAuth resolves the session, loads the user, derives effectiveUserId
// and — via { ownerOnly: true } — returns the 403 that each handler used to write
// by hand. Staff access is unchanged; it is now declared rather than remembered.
export const GET = withAuth(async (req: NextRequest, { effectiveUserId }) => {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const phoneNumber = searchParams.get("phoneNumber")

    // CHANGED: the status filter is NO LONGER a database where-clause. Status is derived
    // from payments now, so filtering on the stored column would hide bills whose real
    // state disagrees with the value the old Mark Paid button left behind. Filtered in
    // memory below, after deriving.
    const bills = await prisma.bill.findMany({
      where: {
        userId: effectiveUserId,
        ...(phoneNumber && { phoneNumber: { contains: phoneNumber } })
      },
      include: {
        items: true
      },
      orderBy: { billDate: "desc" }
    })

    // For each bill, calculate advance total from linked events.
    //
    // CHANGED: this ran a findMany PER BILL inside Promise.all — one query for every
    // row in the list. Every bill is now served by a single lookup: collect all the
    // event ids first, fetch them once, then read from the map.
    const eventIdsFor = (bill: { items: { eventId: string | null }[] }) =>
      Array.from(new Set(
        bill.items
          .map(item => item.eventId)
          .filter((id): id is string => id !== null && id !== undefined)
      ))

    const allEventIds = Array.from(new Set(bills.flatMap(eventIdsFor)))

    const advanceByEvent = new Map<string, number>()
    if (allEventIds.length > 0) {
      const events = await prisma.event.findMany({
        where: { id: { in: allEventIds } },
        select: { id: true, advancePayment: true }
      })
      for (const e of events) advanceByEvent.set(e.id, e.advancePayment || 0)
    }

    // Distinct ids per bill, so two items from the same event count its advance once.
    //
    // CHANGED: paidAmount and status are now DERIVED and override the stored columns in
    // the response. Every rupee a customer pays is an AdvancePayment row on one of the
    // bill's events — advances taken before the bill existed and payments recorded
    // against the bill alike — so the sum of those events' totals IS what this bill has
    // been paid. The stored Bill.paidAmount was set by a "Mark Paid" button and could
    // say "paid" about a bill nobody had paid; nothing reads it any more.
    const billsWithAdvance = bills.map(bill => {
      const paid = eventIdsFor(bill)
        .reduce((sum, id) => sum + (advanceByEvent.get(id) || 0), 0)
      return {
        ...bill,
        advanceTotal: paid,
        paidAmount: paid,
        status: paymentStatusOf(paid, bill.totalAmount)
      }
    })

    const filtered = status && status !== "all"
      ? billsWithAdvance.filter(b => b.status === status)
      : billsWithAdvance

    return NextResponse.json({ success: true, data: filtered })
}, { ownerOnly: true })

export const POST = withAuth(async (req: NextRequest, { effectiveUserId }) => {
    const rawBody = await req.json()
    // CHANGED: schema validation (log-only until VALIDATE_ENFORCE=true). This is the
    // route where an unvalidated quantity/rate becomes NaN and is saved as the bill total.
    const check = validateBody(billSchema, rawBody, "POST /api/bills")
    if (!check.ok) return check.response
    const body = check.data as any
    const {
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

    if (!customerName || !phoneNumber || !items || items.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: "Customer name, phone number, and at least one item are required" 
      }, { status: 400 })
    }

    // CHANGED: the same billTotals() the composer's summary calls, so what the operator
    // approved on screen and what is stored here cannot disagree.
    const { subtotal, discountAmount, totalAmount } =
      billTotals({ items, discountType, discountValue, sgst, cgst })

    const bill = await prisma.bill.create({
      data: {
        billNumber: generateBillNumber(),
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
        userId: effectiveUserId,
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

    return NextResponse.json({ success: true, data: bill })
}, { ownerOnly: true })

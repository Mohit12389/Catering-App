import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { toAmount } from "@/lib/utils"
import { withAuth } from "@/lib/withAuth"

// =============================================
// PAYMENTS RECORDED AGAINST A BILL
// =============================================
// CHANGED: new route. A bill's paid amount used to be a Bill.paidAmount scalar that a
// "Mark Paid" button set to the bill total — no date, no note, no history, and free to
// disagree with the advance rows that tracked the same customer's money. This records a
// payment the same way advances already are: as dated rows in AdvancePayment.
//
// One bill can cover several EVENTS for one customer (the same booking split across
// venues). A payment arrives as one lump, so it is stored as ONE ROW PER EVENT sharing a
// groupId. That keeps Event.advancePayment a straight per-event sum — the history table,
// its remaining-balance line and the exports all keep working untouched — while groupId
// lets the whole payment be deleted as the single thing the operator entered.
//
// The split itself is decided in the dialog (allocateWaterfall proposes, the operator
// overrides). This route does not invent an allocation; it validates the one it is given.

type Ctx = { params: { billId: string } }

// The distinct events a bill covers. Every handler needs this: to know which events a
// payment may legally be allocated to, and to prove the bill belongs to this business.
// One query — the ids come from the bill's own items, which are already loaded.
async function billEventIds(billId: string, userId: string): Promise<Set<string> | null> {
  const bill = await prisma.bill.findFirst({
    where: { id: billId, userId },
    select: { items: { select: { eventId: true } } }
  })
  if (!bill) return null
  return new Set(
    bill.items.map(i => i.eventId).filter((id): id is string => !!id)
  )
}

// Re-sum every event a write touched, inside the same transaction that wrote it.
// CLAUDE.md: the cached Event.advancePayment total may only ever change alongside the
// rows it summarises, or the two drift apart.
//
// CHANGED: was one findMany PER EVENT. The reads are now a single grouped query; only
// the writes remain per-event, because each row gets a different total. Keeping the
// transaction short matters — it holds row locks on Event while it runs.
async function resyncEvents(tx: Prisma.TransactionClient, eventIds: string[]) {
  const ids = Array.from(new Set(eventIds))
  if (ids.length === 0) return

  const sums = await tx.advancePayment.groupBy({
    by: ["eventId"],
    where: { eventId: { in: ids } },
    _sum: { amount: true }
  })
  const totalFor = new Map(ids.map(id => [id, 0]))   // an event whose last payment was
  for (const row of sums) {                          // just deleted has no rows left and
    totalFor.set(row.eventId, row._sum.amount || 0)  // must be reset to 0, not skipped
  }

  for (const id of ids) {
    await tx.event.update({ where: { id }, data: { advancePayment: totalFor.get(id) || 0 } })
  }
}

export const GET = withAuth<Ctx>(async (_req, { effectiveUserId }, { params }) => {
  // Ownership first: without it, any owner could read any business's payment history by
  // guessing a bill id.
  if (!(await billEventIds(params.billId, effectiveUserId))) {
    return NextResponse.json({ success: false, error: "Bill not found" }, { status: 404 })
  }

  const payments = await prisma.advancePayment.findMany({
    where: { billId: params.billId },
    orderBy: { paidDate: "asc" }
  })

  return NextResponse.json({ success: true, data: payments })
}, { ownerOnly: true })

export const POST = withAuth<Ctx>(async (req: NextRequest, { effectiveUserId }, { params }) => {
  const body = await req.json()
  const { paidDate, notes, allocations } = body
  const amount = toAmount(body.amount)

  if (!amount || amount <= 0) {
    return NextResponse.json({ success: false, error: "Amount must be greater than 0" }, { status: 400 })
  }
  // CHANGED: validate the date rather than handing `new Date("nonsense")` to Prisma,
  // which fails deep in the driver with a message no operator can act on.
  const parsedDate = paidDate ? new Date(paidDate) : null
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json({ success: false, error: "A valid payment date is required" }, { status: 400 })
  }
  if (!Array.isArray(allocations) || allocations.length === 0) {
    return NextResponse.json({ success: false, error: "allocations are required" }, { status: 400 })
  }

  const eventIdsOnBill = await billEventIds(params.billId, effectiveUserId)
  if (!eventIdsOnBill) {
    return NextResponse.json({ success: false, error: "Bill not found" }, { status: 404 })
  }

  // Collapse by event before anything else: two entries for the same event are one
  // payment to that event, and writing them as two rows would make the payment
  // impossible to read back as the single thing the operator entered.
  const byEvent = new Map<string, number>()
  for (const a of allocations as any[]) {
    const eventId = String(a?.eventId ?? "")
    const amount = toAmount(a?.amount)
    if (!eventId || amount <= 0) continue
    byEvent.set(eventId, (byEvent.get(eventId) || 0) + amount)
  }
  const clean = Array.from(byEvent.entries()).map(([eventId, amount]) => ({ eventId, amount }))

  if (clean.length === 0) {
    return NextResponse.json({ success: false, error: "Allocate the payment to at least one event" }, { status: 400 })
  }
  // An allocation naming an event this bill does not cover would silently move money
  // onto an unrelated booking — or onto another business's.
  for (const a of clean) {
    if (!eventIdsOnBill.has(a.eventId)) {
      return NextResponse.json({ success: false, error: "Allocation refers to an event that is not on this bill" }, { status: 400 })
    }
  }

  // The split must account for the whole payment. Rounded to whole rupees, matching
  // allocateWaterfall — a paisa of float drift is not a mismatch worth rejecting.
  const allocated = clean.reduce((sum: number, a: { amount: number }) => sum + a.amount, 0)
  if (Math.round(allocated) !== Math.round(amount)) {
    return NextResponse.json({
      success: false,
      error: `Allocations add up to ₹${Math.round(allocated)}, but the payment is ₹${Math.round(amount)}`
    }, { status: 400 })
  }

  const groupId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const created = await prisma.$transaction(async (tx) => {
    // createMany: one round-trip for the whole payment instead of one per event, which
    // keeps the transaction — and the row locks it holds on Event — short.
    await tx.advancePayment.createMany({
      data: clean.map(a => ({
        eventId: a.eventId,
        amount: a.amount,
        paidDate: parsedDate,
        notes: notes?.trim() || null,
        billId: params.billId,
        groupId
      }))
    })
    await resyncEvents(tx, clean.map(a => a.eventId))
    return tx.advancePayment.findMany({ where: { groupId }, orderBy: { paidDate: "asc" } })
  })

  return NextResponse.json({ success: true, data: created })
}, { ownerOnly: true })

// Deletes a whole recorded payment. The operator entered one payment, so removing it
// must remove every row it produced — deleting one leg of a two-event split would leave
// a payment that never happened as far as one event is concerned.
export const DELETE = withAuth<Ctx>(async (req: NextRequest, { effectiveUserId }, { params }) => {
  const { searchParams } = new URL(req.url)
  const groupId = searchParams.get("groupId")
  const paymentId = searchParams.get("id")

  if (!groupId && !paymentId) {
    return NextResponse.json({ success: false, error: "groupId or id is required" }, { status: 400 })
  }

  if (!(await billEventIds(params.billId, effectiveUserId))) {
    return NextResponse.json({ success: false, error: "Bill not found" }, { status: 404 })
  }

  // Scoped to this bill, so a guessed groupId cannot reach another business's rows.
  const rows = await prisma.advancePayment.findMany({
    where: {
      billId: params.billId,
      ...(groupId ? { groupId } : { id: paymentId as string })
    },
    select: { id: true, eventId: true }
  })
  if (rows.length === 0) {
    return NextResponse.json({ success: false, error: "Payment not found" }, { status: 404 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.advancePayment.deleteMany({ where: { id: { in: rows.map(r => r.id) } } })
    await resyncEvents(tx, rows.map(r => r.eventId))
  })

  return NextResponse.json({ success: true, message: "Payment deleted" })
}, { ownerOnly: true })

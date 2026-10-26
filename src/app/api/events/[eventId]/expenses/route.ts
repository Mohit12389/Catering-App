import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/withAuth"

type Ctx = { params: { eventId: string } }

// CHANGED: new route — saves an event's expenses (transport, layout, waiters…), the
// caterer's own cost that the revenue page adds to ingredient cost for profit.
//
// Body: { expenses: [{ name, quantity, rate, notes? }] } — the event's COMPLETE list,
// in display order. Replaces the old list in one transaction (delete + createMany), so
// a save is one request and can't half-apply.
// No ownerOnly: staff fill these on the Event Menu page (owner's decision).
export const PUT = withAuth<Ctx>(async (req: NextRequest, { effectiveUserId }, { params }) => {
  const { expenses } = await req.json()
  if (!Array.isArray(expenses)) {
    return NextResponse.json({ success: false, error: "expenses must be a list" }, { status: 400 })
  }

  const rows: { name: string; quantity: number; rate: number; notes: string | null }[] = []
  for (const e of expenses as { name?: unknown; quantity?: unknown; rate?: unknown; notes?: unknown }[]) {
    const name = typeof e?.name === "string" ? e.name.trim() : ""
    const quantity = Number(e?.quantity)
    const rate = Number(e?.rate)
    if (!name) {
      return NextResponse.json({ success: false, error: "Every expense needs a name" }, { status: 400 })
    }
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(rate) || rate < 0) {
      return NextResponse.json({ success: false, error: `"${name}": quantity and rate must be numbers 0 or more` }, { status: 400 })
    }
    const notes = typeof e?.notes === "string" && e.notes.trim() ? e.notes.trim() : null
    rows.push({ name, quantity, rate, notes })
  }

  // The event must belong to this business (staff → the owner's).
  const event = await prisma.event.findFirst({
    where: { id: params.eventId, userId: effectiveUserId },
    select: { id: true }
  })
  if (!event) {
    return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 })
  }

  await prisma.$transaction([
    prisma.eventExpense.deleteMany({ where: { eventId: event.id } }),
    prisma.eventExpense.createMany({
      data: rows.map((r, i) => ({ ...r, eventId: event.id, position: i }))
    })
  ])

  return NextResponse.json({ success: true })
})

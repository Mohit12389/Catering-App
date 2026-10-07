import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { mealKey } from "@/lib/meals"
import { withAuth } from "@/lib/withAuth"

type Ctx = { params: { eventId: string } }

// CHANGED: new route — saves the drag & drop order of ONE meal's menu items.
//
// Body: { eventItemIds: string[] } — that meal's EventItem ids, in the new order.
//
// Rules enforced here (not just in the UI):
//   - the event must belong to this business (effectiveUserId — staff use the owner's)
//   - every id must be from ONE meal, and the list must be that meal's COMPLETE item
//     list, so an item can never be moved into another meal and no item is left
//     with a stale position
//
// Speed: one read + one write. The write is a single UPDATE for the whole list instead
// of one update per item — from India each query is ~0.25s, so 30 separate updates
// would be ~7s per save (see CLAUDE.md, "slowness is round trips").
export const PUT = withAuth<Ctx>(async (req: NextRequest, { effectiveUserId }, { params }) => {
  const { eventItemIds } = await req.json()

  if (
    !Array.isArray(eventItemIds) || eventItemIds.length === 0 ||
    !eventItemIds.every((id: unknown) => typeof id === "string") ||
    new Set(eventItemIds).size !== eventItemIds.length
  ) {
    return NextResponse.json({ success: false, error: "eventItemIds must be a list of distinct ids" }, { status: 400 })
  }

  // One read: all of this event's items, scoped to the business through the event.
  const allItems = await prisma.eventItem.findMany({
    where: { eventId: params.eventId, event: { userId: effectiveUserId } },
    select: { id: true, mealLabel: true, mealDate: true }
  })
  if (allItems.length === 0) {
    return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 })
  }

  const byId = new Map(allItems.map(ei => [ei.id, ei]))
  const first = byId.get(eventItemIds[0])
  if (!first) {
    return NextResponse.json({ success: false, error: "Item not found in this event" }, { status: 400 })
  }

  // The meal is the composite label::date key — the same one every page groups by.
  const key = mealKey(first.mealLabel, first.mealDate)
  const mealIds = allItems.filter(ei => mealKey(ei.mealLabel, ei.mealDate) === key).map(ei => ei.id)
  const sameMeal = eventItemIds.every((id: string) => {
    const ei = byId.get(id)
    return !!ei && mealKey(ei.mealLabel, ei.mealDate) === key
  })
  if (!sameMeal || mealIds.length !== eventItemIds.length) {
    // Either an id from another meal / event, or the meal changed since the page loaded
    // (an item was added or removed elsewhere). Reloading the page fixes the latter.
    return NextResponse.json({
      success: false,
      error: "This meal's items changed — please reload the page and arrange again"
    }, { status: 409 })
  }

  // One write: position = place in the list (1-based), for every item at once.
  await prisma.$executeRaw`
    UPDATE "EventItem" AS ei
    SET "position" = v.pos::int, "updatedAt" = NOW()
    FROM unnest(${eventItemIds}::text[]) WITH ORDINALITY AS v(id, pos)
    WHERE ei."id" = v.id AND ei."eventId" = ${params.eventId}
  `

  return NextResponse.json({ success: true })
})

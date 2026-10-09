// =============================================
// EVENT HISTORY LIST ROWS
// =============================================
// CHANGED: new module — the body of GET /api/events, moved here unchanged so the
// Event History page can build the same rows on the SERVER (page.tsx) and send them
// with the page, instead of the browser asking /api/events after it loads (one extra
// India→USA round trip). The API route still calls this, so the rules below
// (staff get no advance/bill data, Ready vs Pending, billed share) live in ONE place.

import { prisma } from "@/lib/prisma"
import { mealKey } from "@/lib/meals" // shared composite meal key
import { latestMealDate } from "@/lib/eventRules" // the last-meal date the Done stage needs
import { billingByEvent } from "@/lib/eventBilling" // one place that answers "is it billed, and for how much"

export async function listEvents({ effectiveUserId, role, status }: {
  /** Owner's id for staff, own id for owners (getEffectiveUserId). */
  effectiveUserId: string
  /** The signed-in user's role — "staff" strips all money/bill fields. */
  role: string | null
  status?: string | null
}) {
  const events = await prisma.event.findMany({
    where: {
      userId: effectiveUserId,
      ...(status && { status })
    },
    select: {
      id: true, eventId: true, organizerName: true, phoneNumber: true,
      location: true, homeAddress: true, bookingDate: true, functionDate: true, functionTime: true,
      menuCreationDate: true, guestCount: true, perPlatePrice: true,
      totalAmount: true, advancePayment: true, status: true, notes: true,
      eventItems: {
        select: {
          id: true, itemId: true, mealLabel: true, mealDate: true,
          mealGuests: true, mealPerPlate: true,
          item: { select: { id: true, name: true, category: { select: { id: true, name: true } } } }
        }
      },
      eventIngredients: {
        where: { quantity: { gt: 0 } },
        select: { id: true },
        take: 1
      }
    },
    orderBy: { functionDate: "desc" }
  })

  // CHANGED: an event is only "Ready" once nothing is still flagged for attention —
  // ingredients marked new (blue/green), removed (red) or shared (amber "also in
  // other meals, update qty"). One grouped query for all events, not one per event.
  const pendingByEvent = new Set(
    (await prisma.eventIngredient.groupBy({
      by: ["eventId"],
      where: {
        eventId: { in: events.map(e => e.id) },
        status: { in: ["new", "removed", "shared"] }
      }
    })).map(r => r.eventId)
  )

  // CHANGED: which events already have a bill, and what that bill says each owes.
  //
  // Owner only: staff must not learn anything about billing, so their rows carry no
  // bill info at all and their stage stops at Upcoming / Done / Cancelled.
  const billedByEvent = role === "staff"
    ? new Map()
    : await billingByEvent(events.map(e => e.id), effectiveUserId)

  // CHANGED: staff must not receive advance-payment data. The history table already
  // hides the column and the CSV omits it, but the value was still sitting in this
  // response — visible in the browser's network tab. A permission enforced on only
  // one exit path isn't a permission, so it is stripped server-side too.
  const isStaff = role === "staff"

  // Build unique meal labels for each event (for card display)
  const transformed = events.map(event => {
    const mealsMap = new Map<string, { label: string; date: Date | null; guests: number | null }>() // CHANGED: date was any
    event.eventItems.forEach(ei => {
      if (ei.mealLabel) {
        // CHANGED: was `${label}-${mealDate}`, built by hand. Interpolating a Date
        // gives its full toString(), so two items of the same meal saved with
        // different times of day counted as two meals. mealKey() keys on the DATE
        // only, which is the rule CLAUDE.md requires everywhere.
        const key = mealKey(ei.mealLabel, ei.mealDate)
        if (!mealsMap.has(key)) {
          mealsMap.set(key, { label: ei.mealLabel, date: ei.mealDate, guests: ei.mealGuests })
        }
      }
    })
    const { advancePayment: _advancePayment, ...withoutAdvance } = event
    return {
      ...(isStaff ? withoutAdvance : event),
      eventIngredients: event.eventIngredients.length > 0 ? [{ id: 'has-qty', quantity: 1 }] : [],
      hasPendingIngredients: pendingByEvent.has(event.id),  // CHANGED: blocks the "Ready" badge
      mealLabels: Array.from(mealsMap.values()),
      // CHANGED: the LAST sub-event date. functionDate is the EARLIEST one and must
      // stay that way — it drives the "next event first" sort — so it cannot also
      // answer "is this event over?". A booking with breakfast on the 20th and dinner
      // on the 21st is not finished on the morning of the 21st.
      lastMealDate: latestMealDate(event.eventItems.map(ei => ei.mealDate)),
      billedAs: billedByEvent.get(event.id) || null,
      // CHANGED: what this event actually owes. Once it is on a bill the BILL decides
      // that — a discount or GST applied there has to reach this page, or a customer
      // who paid his discounted total in full keeps showing as Partial here.
      // Falls back to the quote while the event is not yet invoiced.
      receivable: billedByEvent.get(event.id)?.amount ?? event.totalAmount
    }
  })

  return transformed
}

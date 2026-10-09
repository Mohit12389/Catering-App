// =============================================
// ONE EVENT, AS THE DETAIL PAGES SEE IT
// =============================================
// CHANGED: new module — the body of GET /api/events/[eventId], moved here unchanged so
// the Event History detail page can load the event on the SERVER ([eventId]/page.tsx)
// and send it with the page, instead of the browser asking the API after it loads
// (one extra India→USA round trip). The API route still calls this, so the staff rule
// (no advance payments, no bill info) lives in ONE place. Returns null when the event
// does not exist or belongs to another business.

import { prisma } from "@/lib/prisma"
import { latestMealDate } from "@/lib/eventRules" // the last-meal date the Done stage needs
import { billingByEvent } from "@/lib/eventBilling" // one place that answers "is it billed, and for how much"

export async function getEventDetail({ eventId, effectiveUserId, role }: {
  eventId: string
  /** Owner's id for staff, own id for owners (getEffectiveUserId). */
  effectiveUserId: string
  /** The signed-in user's role — "staff" strips all money/bill fields. */
  role: string | null
}) {
  // effectiveUserId keeps this scoped to the requesting business
  const event = await prisma.event.findFirst({
    where: { id: eventId, userId: effectiveUserId },
    select: {
      id: true, eventId: true, organizerName: true, phoneNumber: true,
      location: true, homeAddress: true, bookingDate: true, functionDate: true, functionTime: true,
      menuCreationDate: true, guestCount: true, perPlatePrice: true,
      totalAmount: true, advancePayment: true, status: true, notes: true,
      eventItems: {
        select: {
          id: true, itemId: true, mealLabel: true, mealDate: true,
          mealGuests: true, mealPerPlate: true, mealNotes: true,  // CHANGED: + mealNotes
          position: true,  // CHANGED: drag & drop order within the meal
          item: { select: { id: true, name: true, category: { select: { id: true, name: true, sortOrder: true } } } }
        }
      },
      eventIngredients: {
        select: {
          id: true, ingredientId: true, quantity: true, priceAtEvent: true, status: true, notes: true,
          ingredient: {
            select: { id: true, name: true, unit: true, ratePerUnit: true, category: { select: { id: true, name: true, sortOrder: true } } }
          }
        }
      },
      eventCategorySettings: { select: { id: true, ingredientCategoryId: true, boughtBy: true } },
      advancePayments: { select: { id: true, amount: true, paidDate: true, notes: true, createdAt: true }, orderBy: { paidDate: "asc" } }
    }
  })

  if (!event) return null

  // CHANGED: staff must not receive advance-payment data — not the cached total and
  // not the individual payments. The detail page already hides that whole section,
  // but the amounts, dates and notes were still in this response. See events/route.ts.
  // CHANGED: the LAST sub-event date, which is what decides whether the event has
  // happened. functionDate is deliberately the EARLIEST date (it drives the list sort)
  // and would mark a wedding done while its final dinner is still being cooked.
  const lastMealDate = latestMealDate(event.eventItems.map(ei => ei.mealDate))

  if (role === "staff") {
    const { advancePayment: _advancePayment, advancePayments: _advancePayments, ...withoutAdvance } = event
    // Staff get no bill information at all — see the same rule in events/route.ts.
    return { ...withoutAdvance, lastMealDate }
  }

  // CHANGED: the bill covering this event, if any, and this event's share of it.
  const billedAs = (await billingByEvent([event.id], effectiveUserId)).get(event.id) || null

  return {
    ...event,
    lastMealDate,
    billedAs,
    // Once billed, the BILL decides what is owed — discount and tax included.
    receivable: billedAs?.amount ?? event.totalAmount
  }
}

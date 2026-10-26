// =============================================
// PRICE DATE RANGE (one rule, two entry points)
// =============================================
// CHANGED: extracted from api/ingredients/bulk-price-update so the Price Update page
// (api/ingredients/price-range) picks EXACTLY the same events.
//
// THE RULE: an active event is in the range if its event date OR ANY of its meal
// dates falls in it. Price lives per event (EventIngredient.priceAtEvent), so the
// whole event takes the new price even if only one meal is in range.
// Dates are stored as UTC midnight, so the range is built in UTC too.

import type { Prisma } from "@prisma/client"

const YMD = /^\d{4}-\d{2}-\d{2}$/

/**
 * `{ gte, lte }` for a YYYY-MM-DD start and/or end. Either side may be empty
 * (open-ended). Returns null when both are empty or a date is malformed.
 */
export function eventDateRange(
  startDate?: string | null,
  endDate?: string | null
): { gte?: Date; lte?: Date } | null {
  if (!startDate && !endDate) return null
  if ((startDate && !YMD.test(startDate)) || (endDate && !YMD.test(endDate))) return null
  const range: { gte?: Date; lte?: Date } = {}
  if (startDate) range.gte = new Date(`${startDate}T00:00:00.000Z`)
  if (endDate) range.lte = new Date(`${endDate}T23:59:59.999Z`)
  return range
}

/** Prisma `where` for this user's active events touching the range. */
export function activeEventsInRange(
  effectiveUserId: string,
  range: { gte?: Date; lte?: Date }
): Prisma.EventWhereInput {
  return {
    userId: effectiveUserId,
    status: "active",
    OR: [
      { functionDate: range },
      { eventItems: { some: { mealDate: range } } }
    ]
  }
}

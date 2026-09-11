// =============================================
// EVENT DOMAIN RULES
// =============================================
// CHANGED: these three rules were written inline, some of them twice, in
// app/api/events/route.ts, app/api/events/[eventId]/route.ts and
// app/api/events/copy/route.ts. Each is a documented business rule from CLAUDE.md, so
// each now has one implementation the tests can call directly.

import { mealKey } from "@/lib/meals"

/**
 * RULE: Event.functionDate is the EARLIEST sub-event date — never the first meal the
 * user happened to type. The history and menu lists sort by it ascending so the
 * operator sees the next upcoming event first; any other rule makes that sort wrong.
 *
 * Dates that are missing or unparseable are ignored rather than poisoning the result,
 * which is what `new Date(undefined)` in a sort comparator used to do.
 */
export function earliestMealDate(
  dates: (Date | string | null | undefined)[]
): Date | null {
  let earliest: Date | null = null
  for (const value of dates) {
    if (!value) continue
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) continue
    if (!earliest || date.getTime() < earliest.getTime()) earliest = date
  }
  return earliest
}

/**
 * RULE: an event's total is the sum over its MEALS of guests x per-plate — not over its
 * items. A meal's guest count and price are duplicated onto every one of its EventItem
 * rows, so each meal must be counted exactly once.
 *
 * Meals are identified by the composite `${label}::${date}` key. Keying by label alone
 * merges two same-type meals on different dates and undercounts the bill.
 */
export function eventTotalFromItems(
  items: {
    mealLabel: string | null
    mealDate: Date | string | null
    mealGuests: number | null
    mealPerPlate: number | null
  }[]
): number {
  const perMeal = new Map<string, number>()
  for (const item of items) {
    const key = mealKey(item.mealLabel, item.mealDate)
    if (!perMeal.has(key)) {
      perMeal.set(key, (item.mealGuests || 0) * (item.mealPerPlate || 0))
    }
  }
  let total = 0
  for (const cost of Array.from(perMeal.values())) total += cost
  return total
}

/**
 * RULE: when only SOME meals are copied, an ingredient used by both a copied and a
 * non-copied meal carries a quantity that was sized for more meals than the new event
 * has. Those are flagged for review (status "shared"), never silently recalculated —
 * catering consumption is not linear, so only a human sets the right number.
 *
 * Ingredients used ONLY by non-copied meals are simply not in the copied set.
 */
export function sharedIngredientIds(
  copiedItems: { item: { itemIngredients: { ingredientId: string }[] } }[],
  notCopiedItems: { item: { itemIngredients: { ingredientId: string }[] } }[]
): { copied: Set<string>; shared: Set<string> } {
  const copied = new Set<string>()
  for (const ei of copiedItems) {
    for (const ii of ei.item.itemIngredients) copied.add(ii.ingredientId)
  }

  const notCopied = new Set<string>()
  for (const ei of notCopiedItems) {
    for (const ii of ei.item.itemIngredients) notCopied.add(ii.ingredientId)
  }

  const shared = new Set<string>()
  for (const id of Array.from(copied)) {
    if (notCopied.has(id)) shared.add(id)
  }

  return { copied, shared }
}

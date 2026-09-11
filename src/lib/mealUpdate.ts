// =============================================
// MEAL METADATA UPDATES (the two-phase plan)
// =============================================
// CHANGED: extracted from app/api/events/[eventId]/route.ts PUT. It was inline, and
// mealUpdate.test.ts could only test a hand-written COPY of it — so the test could
// pass while the real route broke. The rule now lives in one place and the test calls
// the shipping function.
//
// THE BUG THIS SHAPE EXISTS TO PREVENT: the original code found AND updated one meal
// at a time, matching rows by their CURRENT label+date. Moving breakfast(20th) to the
// 21st made it collide with breakfast(21st); the next iteration then matched BOTH
// groups and moved them together, silently merging two meals into one.
//
// So planning is separated from writing. Every group's row ids are resolved against
// the ORIGINAL, untouched rows first; the caller then updates by id. Ids never
// collide, so swaps, renames and date moves are safe in any combination.

export interface MealRow {
  id: string
  mealLabel: string | null
  mealDate: Date | string | null
}

export interface MealUpdateInstruction {
  /** The meal to change, identified by its CURRENT label... */
  mealLabel: string | null
  /** ...and optionally its current date. Omitted means "every meal with this label". */
  mealDate?: Date | string | null
  newMealLabel?: string | null
  newMealDate?: Date | string | null
  mealGuests?: number | string | null
  mealPerPlate?: number | string | null
}

export interface MealUpdateData {
  mealLabel?: string
  mealDate?: Date
  mealGuests?: number
  mealPerPlate?: number
}

export interface MealUpdatePlan {
  ids: string[]
  data: MealUpdateData
}

/**
 * True when both values land on the same calendar day in the RUNNING process's time
 * zone. This reproduces the original `setHours(0,0,0,0)` / `setHours(23,59,59,999)`
 * window exactly — that window was local-time too — rather than quietly changing it.
 */
function sameLocalDay(a: Date | string | null | undefined, b: Date | string | null | undefined): boolean {
  if (!a || !b) return false
  const da = new Date(a)
  const db = new Date(b)
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

/** The fields this instruction actually changes. Empty means "nothing to do". */
export function mealUpdateData(meal: MealUpdateInstruction): MealUpdateData {
  const data: MealUpdateData = {}
  if (meal.mealGuests != null) data.mealGuests = parseInt(String(meal.mealGuests))
  if (meal.mealPerPlate != null) data.mealPerPlate = parseFloat(String(meal.mealPerPlate))
  if (meal.newMealLabel) data.mealLabel = meal.newMealLabel
  if (meal.newMealDate) data.mealDate = new Date(meal.newMealDate)
  return data
}

/**
 * PHASE 1. Resolve every instruction against the original rows.
 * Instructions that change nothing, or match no rows, are dropped.
 */
export function planMealUpdates(
  rows: MealRow[],
  instructions: MealUpdateInstruction[]
): MealUpdatePlan[] {
  const plans: MealUpdatePlan[] = []

  for (const meal of instructions) {
    const data = mealUpdateData(meal)
    if (Object.keys(data).length === 0) continue

    const ids = rows
      .filter(r =>
        r.mealLabel === meal.mealLabel &&
        (meal.mealDate ? sameLocalDay(r.mealDate, meal.mealDate) : true)
      )
      .map(r => r.id)

    if (ids.length > 0) plans.push({ ids, data })
  }

  return plans
}

import { describe, it, expect } from "vitest"
import { planMealUpdates, mealUpdateData, type MealRow } from "./mealUpdate"

// CHANGED: this file used to re-implement the route's algorithm in memory and test the
// copy, so it could pass while app/api/events/[eventId]/route.ts broke. It now calls
// planMealUpdates — the same function the route calls.

/** Apply a plan set the way the route does: update matched rows by id. */
function apply(rows: MealRow[], instructions: any[]): MealRow[] {
  const table = rows.map(r => ({ ...r }))
  for (const plan of planMealUpdates(rows, instructions)) {
    for (const row of table) {
      if (!plan.ids.includes(row.id)) continue
      if (plan.data.mealLabel !== undefined) row.mealLabel = plan.data.mealLabel
      if (plan.data.mealDate !== undefined) row.mealDate = plan.data.mealDate
    }
  }
  return table
}

const d = (s: string) => `${s}T00:00:00.000Z`

describe("mealUpdateData", () => {
  it("includes only the fields the instruction actually changes", () => {
    expect(mealUpdateData({ mealLabel: "breakfast" })).toEqual({})
    expect(mealUpdateData({ mealLabel: "breakfast", newMealLabel: "dinner" }))
      .toEqual({ mealLabel: "dinner" })
  })

  it("coerces guests and per-plate from strings, as the form sends them", () => {
    expect(mealUpdateData({ mealLabel: "lunch", mealGuests: "200", mealPerPlate: "12.5" }))
      .toEqual({ mealGuests: 200, mealPerPlate: 12.5 })
  })

  it("treats 0 guests as a real value, not as absent", () => {
    // `!= null` rather than a truthiness check: a meal can legitimately go to 0.
    expect(mealUpdateData({ mealLabel: "lunch", mealGuests: 0 })).toEqual({ mealGuests: 0 })
  })
})

describe("planMealUpdates", () => {
  const rows: MealRow[] = [
    { id: "a", mealLabel: "breakfast", mealDate: d("2026-01-20") },
    { id: "b", mealLabel: "breakfast", mealDate: d("2026-01-21") },
    { id: "c", mealLabel: "dinner", mealDate: d("2026-01-21") },
  ]

  // THE REGRESSION. Swapping two same-type meals' dates used to merge them into one.
  it("keeps two same-type meals separate when their dates are swapped", () => {
    const after = apply(rows, [
      { mealLabel: "breakfast", mealDate: d("2026-01-20"), newMealDate: d("2026-01-21") },
      { mealLabel: "breakfast", mealDate: d("2026-01-21"), newMealDate: d("2026-01-20") },
    ])
    const a = after.find(r => r.id === "a")!
    const b = after.find(r => r.id === "b")!
    expect(new Date(a.mealDate!).toISOString()).toBe(d("2026-01-21"))
    expect(new Date(b.mealDate!).toISOString()).toBe(d("2026-01-20"))
    // Still two distinct meals, not one.
    expect(new Date(a.mealDate!).getTime()).not.toBe(new Date(b.mealDate!).getTime())
  })

  it("plans each instruction against the ORIGINAL rows, never the half-updated ones", () => {
    const plans = planMealUpdates(rows, [
      { mealLabel: "breakfast", mealDate: d("2026-01-20"), newMealDate: d("2026-01-21") },
      { mealLabel: "breakfast", mealDate: d("2026-01-21"), newMealDate: d("2026-01-20") },
    ])
    // Each plan touches exactly one row — the second must NOT have picked up row "a"
    // after it moved onto the 21st.
    expect(plans.map(p => p.ids)).toEqual([["a"], ["b"]])
  })

  it("matches by date only to the day, ignoring the time of day", () => {
    // Built from row c's own date so this holds in any time zone: setHours keeps the
    // local calendar day and only moves the clock within it.
    const sameDayLater = new Date(d("2026-01-21"))
    sameDayLater.setHours(18, 45, 0, 0)
    const plans = planMealUpdates(rows, [
      { mealLabel: "dinner", mealDate: sameDayLater, mealGuests: 300 },
    ])
    expect(plans).toEqual([{ ids: ["c"], data: { mealGuests: 300 } }])
  })

  // Pinned because it is a real sharp edge, not because it is ideal. The original
  // route used setHours(0,0,0,0)..setHours(23,59,59,999) — a LOCAL-time window — and
  // the extraction preserved that rather than silently changing how meals match.
  // It works because real meal dates are stored at UTC midnight, so both sides land
  // on the same local day. A date carrying a late UTC time would NOT match in a
  // UTC+ zone, which this test states out loud so any future change is deliberate.
  it("compares LOCAL calendar days, so a late UTC time can fall on the next day", () => {
    const row: MealRow[] = [{ id: "z", mealLabel: "dinner", mealDate: d("2026-01-21") }]
    const offsetMinutes = new Date(d("2026-01-21")).getTimezoneOffset()
    const lateUtc = "2026-01-21T23:30:00.000Z"
    const plans = planMealUpdates(row, [
      { mealLabel: "dinner", mealDate: lateUtc, mealGuests: 1 },
    ])
    if (offsetMinutes < 0) {
      // Ahead of UTC (e.g. IST): 23:30Z is already the 22nd locally, so no match.
      expect(plans).toEqual([])
    } else {
      expect(plans[0].ids).toEqual(["z"])
    }
  })

  it("matches every meal with the label when no date is given", () => {
    const plans = planMealUpdates(rows, [{ mealLabel: "breakfast", mealGuests: 150 }])
    expect(plans[0].ids).toEqual(["a", "b"])
  })

  it("drops an instruction that changes nothing", () => {
    expect(planMealUpdates(rows, [{ mealLabel: "breakfast" }])).toEqual([])
  })

  it("drops an instruction that matches no rows", () => {
    expect(planMealUpdates(rows, [{ mealLabel: "brunch", mealGuests: 10 }])).toEqual([])
  })

  it("renames a meal type without touching the other meal on that date", () => {
    const after = apply(rows, [
      { mealLabel: "breakfast", mealDate: d("2026-01-21"), newMealLabel: "brunch" },
    ])
    expect(after.find(r => r.id === "b")!.mealLabel).toBe("brunch")
    expect(after.find(r => r.id === "c")!.mealLabel).toBe("dinner")
    expect(after.find(r => r.id === "a")!.mealLabel).toBe("breakfast")
  })

  it("handles a label and date change in one instruction", () => {
    const plans = planMealUpdates(rows, [
      { mealLabel: "dinner", mealDate: d("2026-01-21"), newMealLabel: "lunch", newMealDate: d("2026-01-22") },
    ])
    expect(plans[0].ids).toEqual(["c"])
    expect(plans[0].data.mealLabel).toBe("lunch")
    expect(plans[0].data.mealDate!.toISOString()).toBe(d("2026-01-22"))
  })

  it("ignores rows with no date when the instruction names one", () => {
    const withNull: MealRow[] = [...rows, { id: "x", mealLabel: "breakfast", mealDate: null }]
    const plans = planMealUpdates(withNull, [
      { mealLabel: "breakfast", mealDate: d("2026-01-20"), mealGuests: 50 },
    ])
    expect(plans[0].ids).toEqual(["a"])
  })
})

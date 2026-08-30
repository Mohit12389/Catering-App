import { describe, it, expect } from "vitest"
import { mealKey } from "./meals"

// Models the meal-metadata update in app/api/events/[eventId]/route.ts against an
// in-memory table, so the date-swap merge bug is pinned down by a test.

type Row = { id: string; mealLabel: string | null; mealDate: string | null }
type Instruction = {
  mealLabel: string | null; mealDate: string | null
  newMealLabel?: string | null; newMealDate?: string | null
}

const sameDay = (a: string | null, b: string | null) =>
  (a ? a.split("T")[0] : null) === (b ? b.split("T")[0] : null)

const match = (rows: Row[], ins: Instruction) =>
  rows.filter(r => r.mealLabel === ins.mealLabel && (!ins.mealDate || sameDay(r.mealDate, ins.mealDate)))

/** OLD: find AND update one meal at a time (the buggy version). */
function applyOld(rows: Row[], instructions: Instruction[]): Row[] {
  const table = rows.map(r => ({ ...r }))
  for (const ins of instructions) {
    for (const row of match(table, ins)) {
      if (ins.newMealLabel) row.mealLabel = ins.newMealLabel
      if (ins.newMealDate) row.mealDate = ins.newMealDate
    }
  }
  return table
}

/** NEW: resolve every group's ids first, then apply by id. */
function applyNew(rows: Row[], instructions: Instruction[]): Row[] {
  const table = rows.map(r => ({ ...r }))
  const plans = instructions.map(ins => ({ ids: match(table, ins).map(r => r.id), ins }))
  for (const { ids, ins } of plans) {
    for (const row of table.filter(r => ids.includes(r.id))) {
      if (ins.newMealLabel) row.mealLabel = ins.newMealLabel
      if (ins.newMealDate) row.mealDate = ins.newMealDate
    }
  }
  return table
}

const groupCount = (rows: Row[]) =>
  new Set(rows.map(r => mealKey(r.mealLabel, r.mealDate))).size

const D20 = "2026-08-20T00:00:00.000Z"
const D21 = "2026-08-21T00:00:00.000Z"

// two breakfasts on different days, two menu items each
const twoBreakfasts: Row[] = [
  { id: "a1", mealLabel: "breakfast", mealDate: D20 },
  { id: "a2", mealLabel: "breakfast", mealDate: D20 },
  { id: "b1", mealLabel: "breakfast", mealDate: D21 },
  { id: "b2", mealLabel: "breakfast", mealDate: D21 },
]

// swap their dates
const swap: Instruction[] = [
  { mealLabel: "breakfast", mealDate: D20, newMealDate: D21 },
  { mealLabel: "breakfast", mealDate: D21, newMealDate: D20 },
]

describe("swapping the dates of two same-type meals", () => {
  it("REGRESSION: the old one-at-a-time update merged them into a single meal", () => {
    const out = applyOld(twoBreakfasts, swap)
    expect(groupCount(out)).toBe(1)           // the reported bug
  })

  it("the two-phase update keeps them as two separate meals", () => {
    const out = applyNew(twoBreakfasts, swap)
    expect(groupCount(out)).toBe(2)
  })

  it("the two-phase update actually swaps the dates, keeping items with their meal", () => {
    const out = applyNew(twoBreakfasts, swap)
    const dateOf = (id: string) => out.find(r => r.id === id)!.mealDate
    expect([dateOf("a1"), dateOf("a2")]).toEqual([D21, D21])
    expect([dateOf("b1"), dateOf("b2")]).toEqual([D20, D20])
  })

  it("no menu items are lost in the swap", () => {
    expect(applyNew(twoBreakfasts, swap)).toHaveLength(twoBreakfasts.length)
  })
})

describe("other meal edits still behave", () => {
  const mixed: Row[] = [
    { id: "x1", mealLabel: "breakfast", mealDate: D20 },
    { id: "y1", mealLabel: "dinner", mealDate: D21 },
  ]

  it("renaming a meal type works (dinner -> lunch)", () => {
    const out = applyNew(mixed, [{ mealLabel: "dinner", mealDate: D21, newMealLabel: "lunch" }])
    expect(out.find(r => r.id === "y1")!.mealLabel).toBe("lunch")
    expect(out.find(r => r.id === "x1")!.mealLabel).toBe("breakfast")
  })

  it("moving one meal to a date another meal already occupies still merges them — that is intended", () => {
    // not a swap: the user genuinely asked for both on the same day, same type
    const out = applyNew(
      [{ id: "p", mealLabel: "breakfast", mealDate: D20 }, { id: "q", mealLabel: "breakfast", mealDate: D21 }],
      [{ mealLabel: "breakfast", mealDate: D20, newMealDate: D21 }]
    )
    expect(groupCount(out)).toBe(1)
  })

  it("a three-way date rotation keeps three separate meals", () => {
    const D22 = "2026-08-22T00:00:00.000Z"
    const rows: Row[] = [
      { id: "m1", mealLabel: "lunch", mealDate: D20 },
      { id: "m2", mealLabel: "lunch", mealDate: D21 },
      { id: "m3", mealLabel: "lunch", mealDate: D22 },
    ]
    const out = applyNew(rows, [
      { mealLabel: "lunch", mealDate: D20, newMealDate: D21 },
      { mealLabel: "lunch", mealDate: D21, newMealDate: D22 },
      { mealLabel: "lunch", mealDate: D22, newMealDate: D20 },
    ])
    expect(groupCount(out)).toBe(3)
    expect(applyOld(rows, [
      { mealLabel: "lunch", mealDate: D20, newMealDate: D21 },
      { mealLabel: "lunch", mealDate: D21, newMealDate: D22 },
      { mealLabel: "lunch", mealDate: D22, newMealDate: D20 },
    ]).length).toBe(3)
  })
})

import { describe, it, expect } from "vitest"
import { MEAL_TYPES, MEAL_ORDER, mealKey, compareMeals } from "./meals"

describe("mealKey", () => {
  it("keys by BOTH label and date so two same-type meals on different days stay separate", () => {
    // the composite-key bug from CLAUDE.md: keying by label alone merged these
    expect(mealKey("breakfast", "2026-03-20T00:00:00.000Z"))
      .not.toBe(mealKey("breakfast", "2026-03-21T00:00:00.000Z"))
  })

  it("produces the same key for a Date and its ISO string (copy-event relied on this)", () => {
    expect(mealKey("lunch", new Date("2026-03-20T00:00:00.000Z")))
      .toBe(mealKey("lunch", "2026-03-20T00:00:00.000Z"))
  })

  it("normalises a missing label to 'default' and a missing date to empty", () => {
    expect(mealKey(null, null)).toBe("default::")
    expect(mealKey(undefined, undefined)).toBe("default::")
  })
})

describe("compareMeals", () => {
  it("sorts by date ascending first", () => {
    const out = [
      { label: "breakfast", date: "2026-03-21T00:00:00.000Z" },
      { label: "dinner", date: "2026-03-20T00:00:00.000Z" },
    ].sort(compareMeals)
    expect(out[0].date).toContain("03-20")
  })

  it("sorts same-day meals breakfast -> dinner", () => {
    const d = "2026-03-20T00:00:00.000Z"
    const out = [
      { label: "dinner", date: d }, { label: "snacks", date: d },
      { label: "breakfast", date: d }, { label: "lunch", date: d },
      { label: "high-tea", date: d }, { label: "brunch", date: d },
    ].sort(compareMeals).map(m => m.label)
    expect(out).toEqual(["breakfast", "brunch", "lunch", "high-tea", "snacks", "dinner"])
  })

  it("sorts unknown / missing labels last", () => {
    const d = "2026-03-20T00:00:00.000Z"
    const out = [
      { label: "midnight", date: d }, { label: "breakfast", date: d },
    ].sort(compareMeals).map(m => m.label)
    expect(out).toEqual(["breakfast", "midnight"])
  })

  it("does not throw on null/undefined label or date", () => {
    expect(() => [
      { label: null, date: null }, { label: undefined, date: undefined },
      { label: "lunch", date: "2026-03-20T00:00:00.000Z" },
    ].sort(compareMeals)).not.toThrow()
  })
})

describe("MEAL_TYPES / MEAL_ORDER stay in sync", () => {
  it("every dropdown option has a defined sort rank", () => {
    for (const t of MEAL_TYPES) {
      expect(MEAL_ORDER[t.value], `"${t.value}" has no rank in MEAL_ORDER`).toBeTypeOf("number")
    }
  })

  it("preserves the bilingual Hindi labels", () => {
    expect(MEAL_TYPES.find(t => t.value === "breakfast")?.label).toBe("Breakfast / नाश्ता")
    expect(MEAL_TYPES.find(t => t.value === "dinner")?.label).toBe("Dinner / रात का भोजन")
  })
})

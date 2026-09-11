import { describe, it, expect } from "vitest"
import { earliestMealDate, eventTotalFromItems, sharedIngredientIds } from "./eventRules"

const d = (s: string) => `${s}T00:00:00.000Z`

describe("earliestMealDate", () => {
  it("returns the earliest date, not the first one listed", () => {
    // CLAUDE.md: functionDate is the earliest sub-event date, never the first typed.
    const result = earliestMealDate([d("2026-03-21"), d("2026-03-20"), d("2026-03-22")])
    expect(result!.toISOString()).toBe(d("2026-03-20"))
  })

  it("accepts Date objects as well as strings", () => {
    const result = earliestMealDate([new Date(d("2026-03-21")), d("2026-03-19")])
    expect(result!.toISOString()).toBe(d("2026-03-19"))
  })

  it("skips missing dates instead of letting them win", () => {
    // The old inline sort did new Date(undefined) -> NaN, and a NaN comparator leaves
    // the array in whatever order it started in, so "earliest" became arbitrary.
    const result = earliestMealDate([null, d("2026-03-20"), undefined, ""])
    expect(result!.toISOString()).toBe(d("2026-03-20"))
  })

  it("skips unparseable dates", () => {
    const result = earliestMealDate(["not a date", d("2026-03-20")])
    expect(result!.toISOString()).toBe(d("2026-03-20"))
  })

  it("returns null when there is no usable date at all", () => {
    expect(earliestMealDate([])).toBeNull()
    expect(earliestMealDate([null, undefined, "rubbish"])).toBeNull()
  })
})

describe("eventTotalFromItems", () => {
  const item = (label: string, date: string, guests: number, perPlate: number) =>
    ({ mealLabel: label, mealDate: d(date), mealGuests: guests, mealPerPlate: perPlate })

  it("counts each meal once, however many items it has", () => {
    // Guests and price are duplicated onto every EventItem of a meal.
    const total = eventTotalFromItems([
      item("dinner", "2026-03-20", 200, 500),
      item("dinner", "2026-03-20", 200, 500),
      item("dinner", "2026-03-20", 200, 500),
    ])
    expect(total).toBe(100000)
  })

  it("adds up several meals", () => {
    const total = eventTotalFromItems([
      item("breakfast", "2026-03-20", 100, 200),
      item("dinner", "2026-03-21", 200, 500),
    ])
    expect(total).toBe(20000 + 100000)
  })

  // THE REGRESSION from CLAUDE.md: keying by label alone merged two same-type meals
  // on different dates, so one of them vanished from the bill.
  it("counts two same-type meals on different dates separately", () => {
    const total = eventTotalFromItems([
      item("breakfast", "2026-03-20", 100, 200),
      item("breakfast", "2026-03-21", 300, 200),
    ])
    expect(total).toBe(20000 + 60000)
  })

  it("treats a missing guest count or price as zero", () => {
    const total = eventTotalFromItems([
      { mealLabel: "lunch", mealDate: d("2026-03-20"), mealGuests: null, mealPerPlate: 500 },
      { mealLabel: "dinner", mealDate: d("2026-03-20"), mealGuests: 100, mealPerPlate: null },
    ])
    expect(total).toBe(0)
  })

  it("is 0 for an event with no items", () => {
    expect(eventTotalFromItems([])).toBe(0)
  })
})

describe("sharedIngredientIds", () => {
  const withIngredients = (...ids: string[]) =>
    ({ item: { itemIngredients: ids.map(ingredientId => ({ ingredientId })) } })

  it("flags only the ingredients used by BOTH copied and non-copied meals", () => {
    const { copied, shared } = sharedIngredientIds(
      [withIngredients("rice", "oil")],
      [withIngredients("oil", "paneer")]
    )
    expect(Array.from(copied).sort()).toEqual(["oil", "rice"])
    // oil is sized for both meals, so its quantity needs a human to review it.
    expect(Array.from(shared)).toEqual(["oil"])
  })

  it("flags nothing when every meal is copied", () => {
    const { copied, shared } = sharedIngredientIds([withIngredients("rice", "oil")], [])
    expect(Array.from(copied).sort()).toEqual(["oil", "rice"])
    expect(shared.size).toBe(0)
  })

  it("leaves out ingredients used only by meals that were not copied", () => {
    const { copied } = sharedIngredientIds(
      [withIngredients("rice")],
      [withIngredients("paneer")]
    )
    expect(copied.has("paneer")).toBe(false)
  })

  it("de-duplicates an ingredient shared by several copied items", () => {
    const { copied, shared } = sharedIngredientIds(
      [withIngredients("oil"), withIngredients("oil"), withIngredients("rice")],
      [withIngredients("oil")]
    )
    expect(Array.from(copied).sort()).toEqual(["oil", "rice"])
    expect(Array.from(shared)).toEqual(["oil"])
  })

  it("copes with an empty copy selection", () => {
    const { copied, shared } = sharedIngredientIds([], [withIngredients("oil")])
    expect(copied.size).toBe(0)
    expect(shared.size).toBe(0)
  })
})

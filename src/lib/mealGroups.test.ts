import { describe, it, expect } from "vitest"
import { groupIntoMeals, groupIngredientsByCategory, compareByCategoryThenName } from "./mealGroups"
import { compareMeals } from "./meals"

// Realistic multi-meal booking: one wedding, 3 sub-events, unsorted input,
// two same-type meals on different days (the composite-key trap), plus a
// zero-quantity ingredient and two categories sharing sortOrder 0.
const eventItems: any[] = [
  { id: "i1", itemId: "t1", mealLabel: "dinner",    mealDate: new Date("2026-03-21T00:00:00Z"), mealGuests: 200, mealPerPlate: 500, item: { name: "Paneer", category: { name: "Sabzi", sortOrder: 2 } } },
  { id: "i2", itemId: "t2", mealLabel: "breakfast", mealDate: new Date("2026-03-20T00:00:00Z"), mealGuests: 100, mealPerPlate: 300, item: { name: "Poha",   category: { name: "Nashta", sortOrder: 1 } } },
  { id: "i3", itemId: "t3", mealLabel: "breakfast", mealDate: new Date("2026-03-21T00:00:00Z"), mealGuests: 200, mealPerPlate: 350, item: { name: "Aloo",   category: { name: "Sabzi", sortOrder: 2 } } },
  { id: "i4", itemId: "t4", mealLabel: "breakfast", mealDate: new Date("2026-03-20T00:00:00Z"), mealGuests: 100, mealPerPlate: 300, item: { name: "Aatta",  category: { name: "Nashta", sortOrder: 1 } } },
  { id: "i5", itemId: "t5", mealLabel: null,        mealDate: null,                             mealGuests: null, mealPerPlate: null, item: { name: "Extra", category: null } },
]

const eventIngredients: any[] = [
  { id: "e1", ingredientId: "g1", quantity: 25, notes: "25kg for bhaji box", priceAtEvent: 40, status: "normal", ingredient: { name: "Pyaj",   unit: "Kg", ratePerUnit: 30, category: { id: "c1", name: "Ration", sortOrder: 1 } } },
  { id: "e2", ingredientId: "g2", quantity: 0,  notes: null, priceAtEvent: null, status: "shared", ingredient: { name: "Lahsun", unit: "Kg", ratePerUnit: 80, category: { id: "c1", name: "Ration", sortOrder: 1 } } },
  { id: "e3", ingredientId: "g3", quantity: 10, notes: null, priceAtEvent: null, status: "new",    ingredient: { name: "Dahi",   unit: "Kg", ratePerUnit: 60, category: { id: "c2", name: "Dairy",  sortOrder: 0 } } },
  { id: "e4", ingredientId: "g4", quantity: 5,  notes: null, priceAtEvent: null, status: "normal", ingredient: { name: "Aatta",  unit: "Kg", ratePerUnit: 25, category: { id: "c3", name: "Anaj",   sortOrder: 0 } } },
  { id: "e5", ingredientId: "g5", quantity: 3,  notes: null, priceAtEvent: null, status: "normal", ingredient: null },
]

describe("groupIntoMeals matches the export-route implementation it replaced", () => {
  // verbatim copy of the logic previously inlined in event-docx/event-xlsx
  function legacyExport(items: any[]) {
    const mealGroups: Record<string, any> = {}
    items.forEach(ei => {
      const label = ei.mealLabel || "default"
      const dateStr = ei.mealDate ? ei.mealDate.toISOString().split("T")[0] : ""
      const key = `${label}::${dateStr}`
      if (!mealGroups[key]) {
        mealGroups[key] = {
          label, date: ei.mealDate ? ei.mealDate.toISOString() : null,
          guests: ei.mealGuests || 0, perPlate: ei.mealPerPlate || 0, items: []
        }
      }
      mealGroups[key].items.push({
        name: ei.item.name,
        categorySortOrder: ei.item.category?.sortOrder || 0,
        categoryName: ei.item.category?.name || ""
      })
    })
    Object.values(mealGroups).forEach((g: any) => {
      g.items.sort((a: any, b: any) => a.categorySortOrder - b.categorySortOrder || a.name.localeCompare(b.name))
    })
    return Object.values(mealGroups).sort(compareMeals as any)
  }

  it("produces identical groups, order, and items", () => {
    const legacy = legacyExport(eventItems)
    const next = groupIntoMeals(
      eventItems,
      (ei: any) => ({
        name: ei.item.name,
        categorySortOrder: ei.item.category?.sortOrder || 0,
        categoryName: ei.item.category?.name || ""
      }),
      { sortItems: compareByCategoryThenName }
    ).map(g => ({ ...g, guests: g.guests || 0, perPlate: g.perPlate || 0 }))

    expect(next.map(g => [g.label, g.date, g.guests, g.perPlate])).toEqual(
      legacy.map((g: any) => [g.label, g.date, g.guests, g.perPlate])
    )
    expect(next.map(g => g.items)).toEqual(legacy.map((g: any) => g.items))
  })

  it("keeps two breakfasts on different dates as separate meals", () => {
    const groups = groupIntoMeals(eventItems, (ei: any) => ei.item.name)
    expect(groups.filter(g => g.label === "breakfast")).toHaveLength(2)
  })

  it("orders meals by date, then breakfast before dinner", () => {
    const groups = groupIntoMeals(eventItems, (ei: any) => ei.item.name)
    expect(groups.map(g => `${g.label}@${(g.date || "none").slice(0, 10)}`)).toEqual([
      "default@none", "breakfast@2026-03-20", "breakfast@2026-03-21", "dinner@2026-03-21",
    ])
  })

  it("preserves null guests/perPlate for the pages (must not become 0)", () => {
    const groups = groupIntoMeals(eventItems, (ei: any) => ei.item.name)
    const unset = groups.find(g => g.label === "default")!
    expect(unset.guests).toBeNull()
    expect(unset.perPlate).toBeNull()
  })

  it("returns [] for null/undefined input", () => {
    expect(groupIntoMeals(null, (x: any) => x)).toEqual([])
    expect(groupIntoMeals(undefined, (x: any) => x)).toEqual([])
  })
})

describe("groupIngredientsByCategory matches the implementations it replaced", () => {
  // verbatim copy of the export-route logic (groups by category NAME, no tiebreak)
  function legacyExport(rows: any[]) {
    const ingGroups: Record<string, any> = {}
    rows.forEach(ei => {
      const catName = ei.ingredient?.category?.name || "Other"
      const sortOrder = ei.ingredient?.category?.sortOrder || 0
      if (!ingGroups[catName]) ingGroups[catName] = { categoryName: catName, sortOrder, ingredients: [] }
      ingGroups[catName].ingredients.push({
        name: ei.ingredient?.name || "Unknown",
        quantity: ei.quantity,
        unit: ei.ingredient?.unit || "",
        notes: ei.notes || null
      })
    })
    const sorted = Object.values(ingGroups).sort((a: any, b: any) => a.sortOrder - b.sortOrder)
    sorted.forEach((g: any) => g.ingredients.sort((a: any, b: any) => a.name.localeCompare(b.name)))
    return sorted
  }

  it("matches the export grouping exactly (by name, no name tiebreak)", () => {
    const legacy = legacyExport(eventIngredients) as any[]
    const next = groupIngredientsByCategory(
      eventIngredients,
      (ei: any) => ({
        id: ei.ingredient?.category?.name || "Other",
        name: ei.ingredient?.category?.name || "Other",
        sortOrder: ei.ingredient?.category?.sortOrder || 0
      }),
      (ei: any) => ({
        name: ei.ingredient?.name || "Unknown",
        quantity: ei.quantity,
        unit: ei.ingredient?.unit || "",
        notes: ei.notes || null
      }),
      { sortIngredients: (a, b) => a.name.localeCompare(b.name) }
    )
    expect(next.map(g => [g.categoryName, g.sortOrder])).toEqual(legacy.map(g => [g.categoryName, g.sortOrder]))
    expect(next.map(g => g.ingredients)).toEqual(legacy.map(g => g.ingredients))
  })

  it("tieBreakByName changes ordering of equal-sortOrder categories (so it stays opt-in)", () => {
    const build = (tie: boolean) => groupIngredientsByCategory(
      eventIngredients,
      (ei: any) => ({
        id: ei.ingredient?.category?.id || "uncategorized",
        name: ei.ingredient?.category?.name || "Other",
        sortOrder: ei.ingredient?.category?.sortOrder || 0
      }),
      (ei: any) => ei.ingredient?.name || "Unknown",
      { tieBreakByName: tie }
    ).map(g => g.categoryName)

    // Dairy(0), Anaj(0) and Other(0) all tie; without the flag insertion order wins
    expect(build(false)).toEqual(["Dairy", "Anaj", "Other", "Ration"])
    expect(build(true)).toEqual(["Anaj", "Dairy", "Other", "Ration"])
  })

  it("include() filters zero-quantity rows the way event-history does", () => {
    const groups = groupIngredientsByCategory(
      eventIngredients,
      (ei: any) => ({
        id: ei.ingredient?.category?.id || "uncategorized",
        name: ei.ingredient?.category?.name || "Other",
        sortOrder: ei.ingredient?.category?.sortOrder || 0
      }),
      (ei: any) => ei.ingredient?.name || "Unknown",
      { include: (ei: any) => ei.quantity > 0 }
    )
    const all = groups.flatMap(g => g.ingredients)
    expect(all).not.toContain("Lahsun")   // quantity 0
    expect(all).toContain("Pyaj")
  })

  it("returns [] for null/undefined input", () => {
    expect(groupIngredientsByCategory(null, (x: any) => x, (x: any) => x)).toEqual([])
  })
})

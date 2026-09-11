import { describe, it, expect } from "vitest"
import { planIngredientSave, type IngredientSaveInput } from "./eventIngredients"

// Proves the batched plan writes the same thing the original per-ingredient loop did.
// Submissions carry each ingredient at most once, which is the only shape the app can
// produce: (eventId, ingredientId) is unique, so the page has one row per ingredient.
// The duplicate case is documented in eventIngredients.ts and covered by its own test.

/** Replays the ORIGINAL sequential loop against an in-memory table. */
function oldLoop(
  input: IngredientSaveInput[],
  existingIds: Set<string>,
  rates: Map<string, number | null>
) {
  const rows = new Map<string, { kind: "create" | "update"; data: any }>()
  const present = new Set(existingIds)

  for (const { ingredientId, quantity, notes, status } of input) {
    if (present.has(ingredientId)) {
      const data: any = { quantity }
      if (notes !== undefined) data.notes = notes
      if (status != null) data.status = status
      rows.set(ingredientId, { kind: "update", data })
    } else {
      rows.set(ingredientId, {
        kind: "create",
        data: { quantity, priceAtEvent: rates.get(ingredientId) || null, notes: notes || null },
      })
      present.add(ingredientId)
    }
  }
  return rows
}

describe("planIngredientSave is equivalent to the original loop", () => {
  it("agrees with it on 2000 random submissions", () => {
    const ids = ["rice", "oil", "pyaj", "lahsun", "aatta"]
    const rates = new Map<string, number | null>([
      ["rice", 60], ["oil", 150], ["pyaj", 0], ["lahsun", null], ["aatta", 45],
    ])
    const rnd = (n: number) => Math.floor(Math.random() * n)

    for (let t = 0; t < 2000; t++) {
      const existingIds = new Set(ids.filter(() => Math.random() < 0.5))

      // Each ingredient appears at most once, as the app guarantees.
      const input: IngredientSaveInput[] = ids
        .filter(() => Math.random() < 0.6)
        .map(ingredientId => {
          const row: IngredientSaveInput = { ingredientId, quantity: rnd(100) }
          const n = rnd(3)
          if (n === 1) row.notes = "note"
          else if (n === 2) row.notes = null
          if (rnd(2)) row.status = ["normal", "new", "shared", "removed"][rnd(4)]
          return row
        })

      const { updates, creates } = planIngredientSave(input, existingIds, rates)
      const old = oldLoop(input, existingIds, rates)

      const oldCreates = Array.from(old.entries()).filter(([, v]) => v.kind === "create")
      const oldUpdates = Array.from(old.entries()).filter(([, v]) => v.kind === "update")

      expect(creates.map(c => c.ingredientId).sort()).toEqual(oldCreates.map(([k]) => k).sort())
      expect(updates.map(u => u.ingredientId).sort()).toEqual(oldUpdates.map(([k]) => k).sort())

      for (const c of creates) {
        expect({ quantity: c.quantity, priceAtEvent: c.priceAtEvent, notes: c.notes })
          .toEqual(old.get(c.ingredientId)!.data)
      }
      for (const u of updates) {
        expect(u.data).toEqual(old.get(u.ingredientId)!.data)
      }
    }
  })
})

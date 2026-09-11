import { describe, it, expect } from "vitest"
import { planIngredientSave, newIngredientIds, type IngredientSaveInput } from "./eventIngredients"

const rates = new Map<string, number | null>([["rice", 60], ["oil", 150], ["free", 0], ["unpriced", null]])

describe("newIngredientIds", () => {
  it("returns only ingredients the event does not already have", () => {
    const input: IngredientSaveInput[] = [
      { ingredientId: "rice", quantity: 10 },
      { ingredientId: "oil", quantity: 5 },
    ]
    expect(newIngredientIds(input, new Set(["rice"]))).toEqual(["oil"])
  })

  it("de-duplicates, so the rate lookup asks for each id once", () => {
    const input: IngredientSaveInput[] = [
      { ingredientId: "oil", quantity: 1 },
      { ingredientId: "oil", quantity: 2 },
    ]
    expect(newIngredientIds(input, new Set())).toEqual(["oil"])
  })

  it("is empty when everything already exists", () => {
    expect(newIngredientIds([{ ingredientId: "rice", quantity: 1 }], new Set(["rice"]))).toEqual([])
  })
})

describe("planIngredientSave", () => {
  it("updates what exists and creates what does not", () => {
    const { updates, creates } = planIngredientSave(
      [{ ingredientId: "rice", quantity: 20 }, { ingredientId: "oil", quantity: 5 }],
      new Set(["rice"]),
      rates
    )
    expect(updates).toEqual([{ ingredientId: "rice", data: { quantity: 20 } }])
    expect(creates).toEqual([
      { ingredientId: "oil", quantity: 5, priceAtEvent: 150, notes: null },
    ])
  })

  // The load-bearing distinction: "no notes sent" must not wipe the vendor's packing
  // instruction ("25kg for bhaji box, 100kg separate").
  it("leaves notes alone when the request omits them", () => {
    const { updates } = planIngredientSave(
      [{ ingredientId: "rice", quantity: 20 }], new Set(["rice"]), rates
    )
    expect(updates[0].data).not.toHaveProperty("notes")
  })

  it("clears notes when the request explicitly sends null", () => {
    const { updates } = planIngredientSave(
      [{ ingredientId: "rice", quantity: 20, notes: null }], new Set(["rice"]), rates
    )
    expect(updates[0].data.notes).toBeNull()
  })

  it("writes notes when the request sends text", () => {
    const { updates } = planIngredientSave(
      [{ ingredientId: "rice", quantity: 20, notes: "25kg for bhaji box" }], new Set(["rice"]), rates
    )
    expect(updates[0].data.notes).toBe("25kg for bhaji box")
  })

  it("writes status when sent — this is how the amber shared flag clears", () => {
    const { updates } = planIngredientSave(
      [{ ingredientId: "rice", quantity: 20, status: "normal" }], new Set(["rice"]), rates
    )
    expect(updates[0].data.status).toBe("normal")
  })

  it("omits status when not sent, leaving the stored flag in place", () => {
    const { updates } = planIngredientSave(
      [{ ingredientId: "rice", quantity: 20 }], new Set(["rice"]), rates
    )
    expect(updates[0].data).not.toHaveProperty("status")
  })

  it("stores a master rate of 0 as null, as the original || null did", () => {
    const { creates } = planIngredientSave(
      [{ ingredientId: "free", quantity: 3 }], new Set(), rates
    )
    expect(creates[0].priceAtEvent).toBeNull()
  })

  it("stores null when the ingredient has no master rate at all", () => {
    const { creates } = planIngredientSave(
      [{ ingredientId: "unpriced", quantity: 3 }], new Set(), rates
    )
    expect(creates[0].priceAtEvent).toBeNull()
  })

  it("keeps the LAST entry for a repeated ingredient, as the old loop did", () => {
    const { updates } = planIngredientSave(
      [{ ingredientId: "rice", quantity: 10 }, { ingredientId: "rice", quantity: 99 }],
      new Set(["rice"]),
      rates
    )
    expect(updates).toHaveLength(1)
    expect(updates[0].data.quantity).toBe(99)
  })

  it("never emits the same ingredient as both a create and an update", () => {
    const { updates, creates } = planIngredientSave(
      [{ ingredientId: "oil", quantity: 1 }, { ingredientId: "oil", quantity: 2 }],
      new Set(),
      rates
    )
    expect(creates).toHaveLength(1)
    expect(updates).toHaveLength(0)
  })

  it("handles an empty submission", () => {
    expect(planIngredientSave([], new Set(["rice"]), rates)).toEqual({ updates: [], creates: [] })
  })

  it("keeps quantity 0, which is how an ingredient is zeroed out", () => {
    const { updates } = planIngredientSave(
      [{ ingredientId: "rice", quantity: 0 }], new Set(["rice"]), rates
    )
    expect(updates[0].data.quantity).toBe(0)
  })
})

import { describe, it, expect, vi } from "vitest"
import { parseMasterPrice, setMasterPrice } from "./masterPrice"

// CHANGED: covers the shared master-price rule used by Update Prices and Edit Ingredient.

describe("parseMasterPrice", () => {
  it("accepts numbers and numeric strings, including 0", () => {
    expect(parseMasterPrice(45)).toBe(45)
    expect(parseMasterPrice("12.5")).toBe(12.5)
    expect(parseMasterPrice(0)).toBe(0)
    expect(parseMasterPrice("0")).toBe(0)
  })

  it("rejects empty, negative and non-numbers", () => {
    for (const v of [undefined, null, "", "abc", -1, "-5", NaN, Infinity, {}]) {
      expect(parseMasterPrice(v)).toBeNull()
    }
  })
})

function fakeTx(found: { ratePerUnit: number } | null, locked = 3) {
  const calls: string[] = []
  const tx = {
    ingredient: {
      findFirst: vi.fn(async () => { calls.push("read"); return found }),
      update: vi.fn(async () => { calls.push("master"); return {} }),
    },
    eventIngredient: {
      updateMany: vi.fn(async () => { calls.push("lock"); return { count: locked } }),
    },
  }
  return { tx, calls }
}

describe("setMasterPrice", () => {
  it("locks existing events at the OLD price before changing the master", async () => {
    const { tx, calls } = fakeTx({ ratePerUnit: 40 })
    const result = await setMasterPrice(tx as any, "ing1", "owner1", 55)

    expect(calls).toEqual(["read", "lock", "master"])
    expect(tx.eventIngredient.updateMany).toHaveBeenCalledWith({
      where: { ingredientId: "ing1", priceAtEvent: null, event: { userId: "owner1" } },
      data: { priceAtEvent: 40 },
    })
    expect(tx.ingredient.update).toHaveBeenCalledWith({ where: { id: "ing1" }, data: { ratePerUnit: 55 } })
    expect(result).toEqual({ oldPrice: 40, lockedCount: 3 })
  })

  it("scopes the read to the effective user and writes nothing when not found", async () => {
    const { tx, calls } = fakeTx(null)
    expect(await setMasterPrice(tx as any, "ing1", "other", 55)).toBeNull()
    expect(tx.ingredient.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ing1", userId: "other" } })
    )
    expect(calls).toEqual(["read"])
  })

  it("locks at 0 when the old master price was 0", async () => {
    const { tx } = fakeTx({ ratePerUnit: 0 })
    await setMasterPrice(tx as any, "ing1", "owner1", 10)
    expect(tx.eventIngredient.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { priceAtEvent: 0 } })
    )
  })
})

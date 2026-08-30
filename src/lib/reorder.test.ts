import { describe, it, expect } from "vitest"
import { reorder } from "./reorder"

function mockModel(record: any) {
  const calls: { fn: string; args: any }[] = []
  return {
    calls,
    model: {
      findFirst: async (args: any) => { calls.push({ fn: "findFirst", args }); return record },
      updateMany: async (args: any) => { calls.push({ fn: "updateMany", args }); return { count: 0 } },
      update:     async (args: any) => { calls.push({ fn: "update", args }); return record },
    }
  }
}

const OWNER = { userId: "owner-1" }

describe("reorder", () => {
  it("returns false and writes nothing when the record isn't owned by the caller", async () => {
    const { model, calls } = mockModel(null)
    const ok = await reorder(model, { id: "x", newSortOrder: 2, ownerScope: OWNER })
    expect(ok).toBe(false)
    expect(calls.filter(c => c.fn !== "findFirst")).toHaveLength(0)
  })

  it("scopes the ownership lookup so another business's row can't be reordered", async () => {
    const { model, calls } = mockModel({ id: "x", sortOrder: 3 })
    await reorder(model, { id: "x", newSortOrder: 3, ownerScope: OWNER })
    expect(calls[0].args.where).toEqual({ id: "x", userId: "owner-1" })
  })

  it("is a no-op when the position hasn't changed", async () => {
    const { model, calls } = mockModel({ id: "x", sortOrder: 3 })
    const ok = await reorder(model, { id: "x", newSortOrder: 3, ownerScope: OWNER })
    expect(ok).toBe(true)
    expect(calls.map(c => c.fn)).toEqual(["findFirst"])
  })

  it("moving UP shifts rows at/after the target DOWN by 1", async () => {
    const { model, calls } = mockModel({ id: "x", sortOrder: 5 })
    await reorder(model, { id: "x", newSortOrder: 2, ownerScope: OWNER })
    const many = calls.find(c => c.fn === "updateMany")!
    expect(many.args.where).toEqual({ userId: "owner-1", id: { not: "x" }, sortOrder: { gte: 2 } })
    expect(many.args.data).toEqual({ sortOrder: { increment: 1 } })
    expect(calls.find(c => c.fn === "update")!.args).toEqual({ where: { id: "x" }, data: { sortOrder: 2 } })
  })

  it("moving DOWN shifts the rows in between UP by 1", async () => {
    const { model, calls } = mockModel({ id: "x", sortOrder: 2 })
    await reorder(model, { id: "x", newSortOrder: 5, ownerScope: OWNER })
    const many = calls.find(c => c.fn === "updateMany")!
    expect(many.args.where).toEqual({ userId: "owner-1", id: { not: "x" }, sortOrder: { gt: 2, lte: 5 } })
    expect(many.args.data).toEqual({ sortOrder: { decrement: 1 } })
  })

  it("an UNRANKED row (sortOrder 0) takes the move-UP branch even when moving to a higher number", async () => {
    // preserved verbatim from the original: `sortOrder < oldSortOrder || oldSortOrder === 0`
    const { model, calls } = mockModel({ id: "x", sortOrder: 0 })
    await reorder(model, { id: "x", newSortOrder: 4, ownerScope: OWNER })
    const many = calls.find(c => c.fn === "updateMany")!
    expect(many.args.where.sortOrder).toEqual({ gte: 4 })
    expect(many.args.data).toEqual({ sortOrder: { increment: 1 } })
  })

  it("narrowScope confines ingredient shifts to their own category", async () => {
    const { model, calls } = mockModel({ id: "x", sortOrder: 5, categoryId: "cat-9" })
    await reorder(model, {
      id: "x", newSortOrder: 2, ownerScope: OWNER,
      narrowScope: (rec) => ({ categoryId: rec.categoryId })
    })
    expect(calls.find(c => c.fn === "updateMany")!.args.where).toEqual({
      userId: "owner-1", categoryId: "cat-9", id: { not: "x" }, sortOrder: { gte: 2 }
    })
  })

  it("never shifts the row being moved", async () => {
    const { model, calls } = mockModel({ id: "x", sortOrder: 5 })
    await reorder(model, { id: "x", newSortOrder: 1, ownerScope: OWNER })
    expect(calls.find(c => c.fn === "updateMany")!.args.where.id).toEqual({ not: "x" })
  })
})

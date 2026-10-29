import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/session", () => ({
  auth: vi.fn(),
}))

const tx = {
  ingredient: { findFirst: vi.fn(), update: vi.fn() },
  eventIngredient: { updateMany: vi.fn() },
  ingredientPriceHistory: { createMany: vi.fn() },
  $executeRaw: vi.fn(),
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    ingredient: { count: vi.fn() },
    event: { findMany: vi.fn() },
    eventIngredient: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { auth } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { GET, POST } from "./route"

const range = { gte: new Date("2026-08-13T00:00:00.000Z"), lte: new Date("2026-08-20T23:59:59.999Z") }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth).mockResolvedValue({ userId: "clerk_staff_1" } as any)
  // Staff: everything must be scoped by the OWNER's id.
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "staff-db-id", role: "staff", ownerId: "owner-db-id" } as any)
  vi.mocked(prisma.$transaction).mockImplementation(((fn: any) => fn(tx)) as any)
  tx.$executeRaw.mockResolvedValue(3)
  tx.ingredient.findFirst.mockResolvedValue({ ratePerUnit: 50 })
  tx.eventIngredient.updateMany.mockResolvedValue({ count: 2 })
})

describe("GET /api/ingredients/price-range", () => {
  const get = (qs: string) => GET(new NextRequest(`http://localhost/api/ingredients/price-range?${qs}`), {})

  it("400 without any date", async () => {
    expect((await get("startDate=&endDate=")).status).toBe(400)
  })

  it("lists in-range events and one row per ingredient with its min/max price", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      { id: "ev1", eventId: "E1", organizerName: "A", location: "X", functionDate: new Date("2026-08-14") },
      { id: "ev2", eventId: "E2", organizerName: "B", location: "Y", functionDate: new Date("2026-08-15") },
    ] as any)
    const oil = { id: "oil", name: "Oil", unit: "L", ratePerUnit: 100, category: { name: "Ration", sortOrder: 2 } }
    const milk = { id: "milk", name: "Doodh", unit: "L", ratePerUnit: 60, category: { name: "Dairy", sortOrder: 1 } }
    vi.mocked(prisma.eventIngredient.findMany).mockResolvedValue([
      { priceAtEvent: 90, ingredient: oil },
      { priceAtEvent: null, ingredient: oil },
      { priceAtEvent: null, ingredient: milk },
    ] as any)

    const body = await (await get("startDate=2026-08-13&endDate=2026-08-20")).json()

    const where = vi.mocked(prisma.event.findMany).mock.calls[0][0]!.where as any
    expect(where.userId).toBe("owner-db-id")
    expect(where.status).toBe("active")
    expect(where.OR).toEqual([{ functionDate: range }, { eventItems: { some: { mealDate: range } } }])

    expect(body.data.events).toHaveLength(2)
    // Dairy (rank 1) before Ration (rank 2); oil prices 90 (locked) and 100 (master)
    expect(body.data.ingredients.map((i: any) => i.id)).toEqual(["milk", "oil"])
    expect(body.data.ingredients[1]).toMatchObject({ minPrice: 90, maxPrice: 100, masterPrice: 100, eventCount: 2 })
  })
})

describe("POST /api/ingredients/price-range", () => {
  const post = (body: object) =>
    POST(new NextRequest("http://localhost/api/ingredients/price-range", {
      method: "POST", body: JSON.stringify(body),
    }), {})

  beforeEach(() => {
    vi.mocked(prisma.ingredient.count).mockResolvedValue(2)
    vi.mocked(prisma.event.findMany).mockResolvedValue([{ id: "ev1" }, { id: "ev2" }] as any)
  })

  it("rejects a negative or non-number price before writing anything", async () => {
    const res = await post({ startDate: "2026-08-13", changes: [{ ingredientId: "a", newPrice: -1 }] })
    expect(res.status).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("404 when an ingredient belongs to another business", async () => {
    vi.mocked(prisma.ingredient.count).mockResolvedValue(1)
    const res = await post({ startDate: "2026-08-13", changes: [{ ingredientId: "a", newPrice: 1 }, { ingredientId: "b", newPrice: 2 }] })
    expect(res.status).toBe(404)
    expect(vi.mocked(prisma.ingredient.count).mock.calls[0][0]!.where).toEqual({ id: { in: ["a", "b"] }, userId: "owner-db-id" })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("range only: one raw update, history rows, master untouched", async () => {
    const res = await post({
      startDate: "2026-08-13", endDate: "2026-08-20",
      changes: [{ ingredientId: "a", newPrice: 10 }, { ingredientId: "b", newPrice: 20 }],
    })
    expect(res.status).toBe(200)
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
    // tagged template values: ingredientIds, prices, eventIds
    const values = tx.$executeRaw.mock.calls[0].slice(1)
    expect(values).toEqual([["a", "b"], [10, 20], ["ev1", "ev2"]])
    expect(tx.ingredient.update).not.toHaveBeenCalled()
    expect(tx.ingredientPriceHistory.createMany).toHaveBeenCalledTimes(1)
  })

  it("setMaster: locks old master and changes it for each ingredient BEFORE the range update", async () => {
    vi.mocked(prisma.ingredient.count).mockResolvedValue(1)
    const res = await post({ startDate: "2026-08-13", setMaster: true, changes: [{ ingredientId: "a", newPrice: 10 }] })
    expect(res.status).toBe(200)
    expect(tx.eventIngredient.updateMany).toHaveBeenCalledWith({
      where: { ingredientId: "a", priceAtEvent: null, event: { userId: "owner-db-id" } },
      data: { priceAtEvent: 50 },
    })
    expect(tx.ingredient.update).toHaveBeenCalledWith({ where: { id: "a" }, data: { ratePerUnit: 10 } })
    expect(tx.ingredient.update.mock.invocationCallOrder[0]).toBeLessThan(tx.$executeRaw.mock.invocationCallOrder[0])
  })
})

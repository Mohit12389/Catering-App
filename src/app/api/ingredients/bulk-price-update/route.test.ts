import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    ingredient: { findFirst: vi.fn() },
    event: { findMany: vi.fn() },
    eventIngredient: { updateMany: vi.fn() },
    ingredientPriceHistory: { create: vi.fn() },
  },
}))

import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { POST } from "./route"

// A date-range price update matches events by EVENT date or ANY meal date —
// not menuCreationDate — so a 12 Aug event with a 13 Aug meal is caught by 13–20 Aug.
describe("POST /api/ingredients/bulk-price-update (date range)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_owner_1" } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "owner-db-id", role: "owner", ownerId: null } as any)
    vi.mocked(prisma.ingredient.findFirst).mockResolvedValue({ ratePerUnit: 50 } as any)
    vi.mocked(prisma.event.findMany).mockResolvedValue([{ id: "ev1" }] as any)
    vi.mocked(prisma.eventIngredient.updateMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(prisma.ingredientPriceHistory.create).mockResolvedValue({} as any)
  })

  const post = (body: object) =>
    POST(new NextRequest("http://localhost/api/ingredients/bulk-price-update", {
      method: "POST", body: JSON.stringify(body),
    }), {})

  it("filters on functionDate OR any meal date, in UTC, never menuCreationDate", async () => {
    const res = await post({ ingredientId: "ing1", newPrice: 60, startDate: "2026-08-13", endDate: "2026-08-20" })
    expect(res.status).toBe(200)

    const range = { gte: new Date("2026-08-13T00:00:00.000Z"), lte: new Date("2026-08-20T23:59:59.999Z") }
    const where = vi.mocked(prisma.event.findMany).mock.calls[0][0]!.where as any
    expect(where.userId).toBe("owner-db-id")
    expect(where.status).toBe("active")
    expect(where.OR).toEqual([
      { functionDate: range },
      { eventItems: { some: { mealDate: range } } },
    ])
    expect(where.menuCreationDate).toBeUndefined()
    expect(prisma.eventIngredient.updateMany).toHaveBeenCalledWith({
      where: { ingredientId: "ing1", eventId: { in: ["ev1"] } },
      data: { priceAtEvent: 60 },
    })
  })

  it("supports a start date only (open-ended range)", async () => {
    await post({ ingredientId: "ing1", newPrice: 60, startDate: "2026-08-13" })
    const where = vi.mocked(prisma.event.findMany).mock.calls[0][0]!.where as any
    expect(where.OR[0]).toEqual({ functionDate: { gte: new Date("2026-08-13T00:00:00.000Z") } })
  })
})

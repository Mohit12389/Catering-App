import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    event: { findMany: vi.fn() },
    categoryPayment: { findMany: vi.fn() },
    ingredientCategory: { findMany: vi.fn() },
  },
}))

import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { GET } from "./route"

const get = () => GET(new NextRequest("http://localhost/api/procurement?startDate=2026-11-01&endDate=2026-11-30"), {})

const event = (id: string, expenses: { name: string; quantity: number; rate: number; notes: string | null }[]) => ({
  id, eventId: `E-${id}`, organizerName: `Org ${id}`, phoneNumber: "1", location: "Hall",
  functionDate: new Date("2026-11-12"), guestCount: 100,
  eventIngredients: [], eventCategorySettings: [], expenses,
})

// Extra Expenses: one row per event that has any, totals by name, kept OUT of the
// ingredient grandTotal. Owner only, like the rest of procurement.
describe("GET /api/procurement — extra expenses", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_owner_1" } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "owner-db-id", role: "owner", ownerId: null } as any)
    vi.mocked(prisma.categoryPayment.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.ingredientCategory.findMany).mockResolvedValue([] as any)
  })

  it("lists events with expenses, sums by name, leaves grandTotal alone", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      event("a", [
        { name: "Waiters", quantity: 12, rate: 600, notes: null },
        { name: "Transport", quantity: 1, rate: 8000, notes: "2 trips" },
      ]),
      event("b", []),
      event("c", [{ name: "Waiters", quantity: 5, rate: 600, notes: null }]),
    ] as any)

    const { data } = await (await get()).json()

    expect(data.expenses.events.map((e: any) => e.eventDbId)).toEqual(["a", "c"])
    expect(data.expenses.events[0].total).toBe(15200)
    expect(data.expenses.events[0].items[0].amount).toBe(7200)
    expect(data.expenses.byName).toEqual([
      { name: "Waiters", total: 10200 },
      { name: "Transport", total: 8000 },
    ])
    expect(data.expenses.total).toBe(18200)
    expect(data.summary.grandTotal).toBe(0)
  })

  it("staff get 403", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "staff-db-id", role: "staff", ownerId: "owner-db-id" } as any)
    expect((await get()).status).toBe(403)
  })
})

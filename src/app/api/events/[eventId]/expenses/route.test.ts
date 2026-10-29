import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/session", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    event: { findFirst: vi.fn() },
    eventExpense: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { auth } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { PUT } from "./route"

const put = (body: object) =>
  PUT(new NextRequest("http://localhost/api/events/ev1/expenses", {
    method: "PUT", body: JSON.stringify(body),
  }), { params: { eventId: "ev1" } })

// Event expenses: staff may save them (they fill them on the Event Menu page), scoped
// to the OWNER's events; the whole list is replaced in one transaction.
describe("PUT /api/events/[eventId]/expenses", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_staff_1" } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "staff-db-id", role: "staff", ownerId: "owner-db-id" } as any)
    vi.mocked(prisma.event.findFirst).mockResolvedValue({ id: "ev1" } as any)
    vi.mocked(prisma.$transaction).mockResolvedValue([] as any)
  })

  it("staff can save; rows are trimmed, positioned, and scoped to the owner's event", async () => {
    const res = await put({ expenses: [
      { name: " Waiters ", quantity: 12, rate: 600, notes: " dinner " },
      { name: "Transport", quantity: 1, rate: 8000, notes: "" },
    ] })
    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.event.findFirst).mock.calls[0][0]!.where).toEqual({ id: "ev1", userId: "owner-db-id" })
    expect(prisma.eventExpense.deleteMany).toHaveBeenCalledWith({ where: { eventId: "ev1" } })
    expect(prisma.eventExpense.createMany).toHaveBeenCalledWith({ data: [
      { name: "Waiters", quantity: 12, rate: 600, notes: "dinner", eventId: "ev1", position: 0 },
      { name: "Transport", quantity: 1, rate: 8000, notes: null, eventId: "ev1", position: 1 },
    ] })
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it("an empty list clears the event's expenses", async () => {
    expect((await put({ expenses: [] })).status).toBe(200)
    expect(prisma.eventExpense.createMany).toHaveBeenCalledWith({ data: [] })
  })

  it("rejects a row without a name or with a negative rate, before writing", async () => {
    expect((await put({ expenses: [{ name: " ", quantity: 1, rate: 5 }] })).status).toBe(400)
    expect((await put({ expenses: [{ name: "Tent", quantity: 1, rate: -5 }] })).status).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("404 for another business's event", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue(null)
    expect((await put({ expenses: [] })).status).toBe(404)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})

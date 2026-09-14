import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    event: { findMany: vi.fn() },
    // CHANGED: the route now also asks which events still have flagged ingredients,
    // so the "Ready" badge can stay Pending while any remain
    eventIngredient: { groupBy: vi.fn() },
    // CHANGED: the route now reads BillItem.eventId backwards (via lib/eventBilling) to
    // tell which events already have an invoice and what that invoice says each owes.
    bill: { findMany: vi.fn() },
  },
}))

import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { GET } from "./route"

// Regression test for the owner/staff data-isolation rule documented in
// CLAUDE.md: routes must scope queries with getEffectiveUserId(dbUser),
// never dbUser.id directly, or staff/owner data leaks or splits.
describe("GET /api/events", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.eventIngredient.groupBy).mockResolvedValue([] as any)
    vi.mocked(prisma.bill.findMany).mockResolvedValue([] as any)
  })

  it("scopes the query to the owner's userId when called by a staff account", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_staff_1" } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "staff-db-id",
      role: "staff",
      ownerId: "owner-db-id",
    } as any)
    vi.mocked(prisma.event.findMany).mockResolvedValue([])

    const req = new NextRequest("http://localhost/api/events")
    const res = await GET(req, {})

    expect(res.status).toBe(200)
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "owner-db-id" }),
      })
    )
  })

  it("scopes the query to the owner's own userId when called by the owner", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_owner_1" } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "owner-db-id",
      role: "owner",
      ownerId: null,
    } as any)
    vi.mocked(prisma.event.findMany).mockResolvedValue([])

    const req = new NextRequest("http://localhost/api/events")
    await GET(req, {})

    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "owner-db-id" }),
      })
    )
  })

  // CHANGED: the Billed / Completed stages are derived from BillItem.eventId, and staff
  // must learn nothing about billing — not the bill number, not even that one exists.
  // CLAUDE.md: a permission enforced on only one exit path is not a permission.
  it("tells the owner which events are already billed, and what the bill says they owe", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_owner_1" } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "owner-db-id", role: "owner", ownerId: null,
    } as any)
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      { id: "evt-billed", totalAmount: 100000, eventItems: [], eventIngredients: [] },
      { id: "evt-unbilled", totalAmount: 50000, eventItems: [], eventIngredients: [] },
    ] as any)
    // Quoted at ₹100,000, billed at ₹90,000 after a ₹10,000 discount.
    vi.mocked(prisma.bill.findMany).mockResolvedValue([{
      id: "bill-1", billNumber: "BILL-2026-AAAA", billDate: new Date(),
      subtotal: 100000, discountAmount: 10000, totalAmount: 90000,
      items: [{ eventId: "evt-billed", amount: 100000 }],
    }] as any)

    const res = await GET(new NextRequest("http://localhost/api/events"), {})
    const body = await res.json()

    const billed = body.data.find((e: any) => e.id === "evt-billed")
    const unbilled = body.data.find((e: any) => e.id === "evt-unbilled")

    // The breakdown the event page shows, so a smaller-than-quoted total is explained
    // on screen instead of just appearing.
    expect(billed.billedAs).toEqual({
      billId: "bill-1",
      billNumber: "BILL-2026-AAAA",
      amount: 90000,
      itemsTotal: 100000,
      discountAmount: 10000,
      taxAmount: 0,
    })
    // The discount reaches the history page: this event owes 90,000, not the 100,000
    // quote. Without it, a customer who paid the discounted total in full stayed
    // stuck on "Partial" here.
    expect(billed.receivable).toBe(90000)

    expect(unbilled.billedAs).toBeNull()
    expect(unbilled.receivable).toBe(50000)   // no bill yet, so the quote stands
  })

  it("sends staff no bill information at all, and does not even ask for it", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_staff_1" } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "staff-db-id", role: "staff", ownerId: "owner-db-id",
    } as any)
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      { id: "evt-billed", totalAmount: 100000, eventItems: [], eventIngredients: [] },
    ] as any)

    const res = await GET(new NextRequest("http://localhost/api/events"), {})
    const body = await res.json()

    expect(body.data[0].billedAs).toBeNull()
    expect(prisma.bill.findMany).not.toHaveBeenCalled()
  })

  // CHANGED: the LAST sub-event date, which is what decides whether an event is over.
  // functionDate is the EARLIEST date and drives the list sort, so it cannot answer this.
  it("returns the last sub-event date, not the first", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_owner_1" } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "owner-db-id", role: "owner", ownerId: null,
    } as any)
    vi.mocked(prisma.event.findMany).mockResolvedValue([{
      id: "evt-1",
      eventItems: [
        { mealLabel: "breakfast", mealDate: new Date("2026-11-20T00:00:00.000Z") },
        { mealLabel: "dinner", mealDate: new Date("2026-11-21T00:00:00.000Z") },
      ],
      eventIngredients: [],
    }] as any)

    const res = await GET(new NextRequest("http://localhost/api/events"), {})
    const body = await res.json()

    expect(new Date(body.data[0].lastMealDate).toISOString()).toBe("2026-11-21T00:00:00.000Z")
  })

  // CHANGED: "Ready" must stay Pending while any ingredient is still flagged
  // added (blue/green), removed (red) or shared (amber "also in other meals").
  it("flags events that still have ingredients needing attention", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_owner_1" } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "owner-db-id", role: "owner", ownerId: null,
    } as any)
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      { id: "evt-flagged", eventItems: [], eventIngredients: [{ id: "x" }] },
      { id: "evt-clean",   eventItems: [], eventIngredients: [{ id: "y" }] },
    ] as any)
    vi.mocked(prisma.eventIngredient.groupBy).mockResolvedValue([{ eventId: "evt-flagged" }] as any)

    const res = await GET(new NextRequest("http://localhost/api/events"), {})
    const body = await res.json()

    const flagged = body.data.find((e: any) => e.id === "evt-flagged")
    const clean = body.data.find((e: any) => e.id === "evt-clean")
    expect(flagged.hasPendingIngredients).toBe(true)
    expect(clean.hasPendingIngredients).toBe(false)
  })

  it("only counts the three attention statuses as pending", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_owner_1" } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "owner-db-id", role: "owner", ownerId: null,
    } as any)
    vi.mocked(prisma.event.findMany).mockResolvedValue([])
    vi.mocked(prisma.eventIngredient.groupBy).mockResolvedValue([] as any)

    await GET(new NextRequest("http://localhost/api/events"), {})

    expect(prisma.eventIngredient.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["new", "removed", "shared"] },
        }),
      })
    )
  })

  it("returns 401 when there is no authenticated Clerk user", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as any)

    const req = new NextRequest("http://localhost/api/events")
    const res = await GET(req, {})

    expect(res.status).toBe(401)
    expect(prisma.event.findMany).not.toHaveBeenCalled()
  })

  it("returns 404 when the Clerk user has no matching local User row", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_unknown" } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const req = new NextRequest("http://localhost/api/events")
    const res = await GET(req, {})

    expect(res.status).toBe(404)
  })
})

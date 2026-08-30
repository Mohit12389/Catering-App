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
    const res = await GET(req)

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
    await GET(req)

    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "owner-db-id" }),
      })
    )
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

    const res = await GET(new NextRequest("http://localhost/api/events"))
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

    await GET(new NextRequest("http://localhost/api/events"))

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
    const res = await GET(req)

    expect(res.status).toBe(401)
    expect(prisma.event.findMany).not.toHaveBeenCalled()
  })

  it("returns 404 when the Clerk user has no matching local User row", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_unknown" } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const req = new NextRequest("http://localhost/api/events")
    const res = await GET(req)

    expect(res.status).toBe(404)
  })
})

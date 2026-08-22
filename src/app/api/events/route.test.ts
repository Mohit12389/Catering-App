import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    event: { findMany: vi.fn() },
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

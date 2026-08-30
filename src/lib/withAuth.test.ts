import { describe, it, expect, vi, beforeEach } from "vitest"

const authMock = vi.fn()
const findUniqueMock = vi.fn()

vi.mock("@clerk/nextjs/server", () => ({ auth: () => authMock() }))
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: (a: any) => findUniqueMock(a) } } }))

import { NextResponse } from "next/server"
import { withAuth } from "./withAuth"

const req = (method = "GET") =>
  ({ method, url: "https://example.test/api/thing" }) as any

const OWNER = { id: "owner-1", role: "owner", ownerId: null }
const STAFF = { id: "staff-1", role: "staff", ownerId: "owner-1" }

beforeEach(() => {
  authMock.mockReset()
  findUniqueMock.mockReset()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("withAuth", () => {
  it("401s when there is no Clerk session, without touching the database", async () => {
    authMock.mockResolvedValue({ userId: null })
    const handler = vi.fn()
    const res = await withAuth(handler)(req(), {})
    expect(res.status).toBe(401)
    expect(findUniqueMock).not.toHaveBeenCalled()
    expect(handler).not.toHaveBeenCalled()
  })

  it("404s when the Clerk user has no DB row yet", async () => {
    authMock.mockResolvedValue({ userId: "clerk-1" })
    findUniqueMock.mockResolvedValue(null)
    const res = await withAuth(vi.fn())(req(), {})
    expect(res.status).toBe(404)
  })

  it("onMissingUser overrides the 404 (empty list for a brand-new account)", async () => {
    authMock.mockResolvedValue({ userId: "clerk-1" })
    findUniqueMock.mockResolvedValue(null)
    const res = await withAuth(vi.fn(), {
      onMissingUser: () => NextResponse.json({ success: true, data: [] })
    })(req(), {})
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, data: [] })
  })

  it("gives an OWNER their own id as effectiveUserId", async () => {
    authMock.mockResolvedValue({ userId: "clerk-1" })
    findUniqueMock.mockResolvedValue(OWNER)
    let seen: any
    await withAuth(async (_r, ctx) => { seen = ctx; return NextResponse.json({ ok: true }) })(req(), {})
    expect(seen.effectiveUserId).toBe("owner-1")
  })

  it("gives STAFF the OWNER's id as effectiveUserId (staff read the owner's data)", async () => {
    authMock.mockResolvedValue({ userId: "clerk-2" })
    findUniqueMock.mockResolvedValue(STAFF)
    let seen: any
    await withAuth(async (_r, ctx) => { seen = ctx; return NextResponse.json({ ok: true }) })(req(), {})
    expect(seen.effectiveUserId).toBe("owner-1")
    expect(seen.dbUser.id).toBe("staff-1")
  })

  it("403s STAFF on an ownerOnly route and never runs the handler", async () => {
    authMock.mockResolvedValue({ userId: "clerk-2" })
    findUniqueMock.mockResolvedValue(STAFF)
    const handler = vi.fn()
    const res = await withAuth(handler, { ownerOnly: true })(req(), {})
    expect(res.status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
  })

  it("allows an OWNER through an ownerOnly route", async () => {
    authMock.mockResolvedValue({ userId: "clerk-1" })
    findUniqueMock.mockResolvedValue(OWNER)
    const res = await withAuth(
      async () => NextResponse.json({ success: true }), { ownerOnly: true }
    )(req(), {})
    expect(res.status).toBe(200)
  })

  it("allows STAFF through a route that is NOT ownerOnly", async () => {
    authMock.mockResolvedValue({ userId: "clerk-2" })
    findUniqueMock.mockResolvedValue(STAFF)
    const res = await withAuth(async () => NextResponse.json({ success: true }))(req(), {})
    expect(res.status).toBe(200)
  })

  it("turns an unhandled throw into a 500 instead of leaking the error", async () => {
    authMock.mockResolvedValue({ userId: "clerk-1" })
    findUniqueMock.mockResolvedValue(OWNER)
    const res = await withAuth(async () => { throw new Error("boom: secret detail") })(req("POST"), {})
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain("secret detail")
  })

  it("only ever selects id/role/ownerId from the user row", async () => {
    authMock.mockResolvedValue({ userId: "clerk-1" })
    findUniqueMock.mockResolvedValue(OWNER)
    await withAuth(async () => NextResponse.json({}))(req(), {})
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { clerkId: "clerk-1" },
      select: { id: true, role: true, ownerId: true }
    })
  })

  it("passes the Next.js route context (dynamic params) through as the third arg", async () => {
    authMock.mockResolvedValue({ userId: "clerk-1" })
    findUniqueMock.mockResolvedValue(OWNER)
    let seenCtx: any
    await withAuth<{ params: { eventId: string } }>(
      async (_r, _a, ctx) => { seenCtx = ctx; return NextResponse.json({}) }
    )(req(), { params: { eventId: "evt-9" } })
    expect(seenCtx).toEqual({ params: { eventId: "evt-9" } })
  })
})

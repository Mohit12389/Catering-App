import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import bcrypt from "bcryptjs"

// CHANGED: own login (2026-10-28). The real password hashing runs; only the cookie
// write and the database are faked.
vi.mock("@/lib/session", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/session")>()),
  startSession: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findFirst: vi.fn(), create: vi.fn() } },
}))

import { startSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { POST as signIn } from "./sign-in/route"
import { POST as signUp } from "./sign-up/route"

const req = (path: string, body: object) =>
  new NextRequest(`http://localhost/api/auth/${path}`, { method: "POST", body: JSON.stringify(body) })

describe("POST /api/auth/sign-in", () => {
  beforeEach(() => vi.clearAllMocks())

  it("logs into the EXISTING user row found by email — same row, same data", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "owner-db-id", passwordHash: await bcrypt.hash("secret1", 4) } as any)
    const res = await signIn(req("sign-in", { email: "  Owner@Gmail.com ", password: "secret1" }))
    expect(res.status).toBe(200)
    expect(startSession).toHaveBeenCalledWith("owner-db-id")
    // looked up case-insensitively, trimmed
    expect(vi.mocked(prisma.user.findFirst).mock.calls[0][0]).toMatchObject({
      where: { email: { equals: "owner@gmail.com", mode: "insensitive" } },
    })
  })

  it("refuses a wrong password", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "owner-db-id", passwordHash: await bcrypt.hash("secret1", 4) } as any)
    const res = await signIn(req("sign-in", { email: "owner@gmail.com", password: "wrong" }))
    expect(res.status).toBe(401)
    expect(startSession).not.toHaveBeenCalled()
  })

  it("refuses an old Clerk account that has no password yet", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "staff-db-id", passwordHash: null } as any)
    const res = await signIn(req("sign-in", { email: "staff@gmail.com", password: "anything" }))
    expect(res.status).toBe(401)
    expect(startSession).not.toHaveBeenCalled()
  })

  it("refuses an unknown email", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
    expect((await signIn(req("sign-in", { email: "x@y.com", password: "secret1" }))).status).toBe(401)
  })
})

describe("POST /api/auth/sign-up", () => {
  beforeEach(() => vi.clearAllMocks())

  it("can NOT take over an existing account (e.g. an old Clerk user with no password)", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "owner-db-id" } as any)
    const res = await signUp(req("sign-up", { name: "X", email: "OWNER@gmail.com", password: "secret1" }))
    expect(res.status).toBe(409)
    expect(prisma.user.create).not.toHaveBeenCalled()
    expect(startSession).not.toHaveBeenCalled()
  })

  it("creates a new row with a hashed password and logs it in", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "new-id" } as any)
    const res = await signUp(req("sign-up", { name: "Ram", email: "Ram@Gmail.com", password: "secret1" }))
    expect(res.status).toBe(200)
    const data = vi.mocked(prisma.user.create).mock.calls[0][0].data as { email: string; passwordHash: string }
    expect(data.email).toBe("ram@gmail.com")
    expect(data.passwordHash).not.toBe("secret1")
    expect(await bcrypt.compare("secret1", data.passwordHash)).toBe(true)
    expect(startSession).toHaveBeenCalledWith("new-id")
  })

  it("rejects a short password", async () => {
    const res = await signUp(req("sign-up", { name: "Ram", email: "ram@gmail.com", password: "123" }))
    expect(res.status).toBe(400)
  })
})

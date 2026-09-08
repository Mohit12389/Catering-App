import { describe, it, expect, vi, beforeEach } from "vitest"

const findUniqueMock = vi.fn()
const createMock = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: (a: any) => findUniqueMock(a), create: (a: any) => createMock(a) } }
}))

// Minimal stand-in for Prisma's error class so the instanceof check is exercised
// without pulling the generated client into the test run.
vi.mock("@prisma/client", () => {
  class PrismaClientKnownRequestError extends Error {
    code: string
    constructor(message: string, opts: { code: string }) {
      super(message)
      this.code = opts.code
    }
  }
  return { Prisma: { PrismaClientKnownRequestError } }
})

import { Prisma } from "@prisma/client"
import { ensureDbUser } from "./ensureDbUser"

const P2002 = () =>
  new (Prisma.PrismaClientKnownRequestError as any)("Unique constraint failed", { code: "P2002" })

const ROW = { id: "u1", clerkId: "clerk-1", email: "a@b.com", name: "A" }
const FALLBACK = { email: "a@b.com", name: "A" }

beforeEach(() => {
  findUniqueMock.mockReset()
  createMock.mockReset()
})

describe("ensureDbUser", () => {
  it("returns the existing row without creating anything", async () => {
    findUniqueMock.mockResolvedValue(ROW)
    await expect(ensureDbUser("clerk-1", FALLBACK)).resolves.toEqual(ROW)
    expect(createMock).not.toHaveBeenCalled()
  })

  it("creates the row on an account's first visit", async () => {
    findUniqueMock.mockResolvedValue(null)
    createMock.mockResolvedValue(ROW)
    await expect(ensureDbUser("clerk-1", FALLBACK)).resolves.toEqual(ROW)
    expect(createMock).toHaveBeenCalledWith({
      data: { clerkId: "clerk-1", email: "a@b.com", name: "A" }
    })
  })

  // The reported bug: layout.tsx and dashboard/page.tsx render concurrently and
  // both tried to insert, so the loser crashed the whole dashboard with a 500.
  it("survives losing the insert race and returns the winner's row", async () => {
    findUniqueMock.mockResolvedValueOnce(null).mockResolvedValueOnce(ROW)
    createMock.mockRejectedValue(P2002())
    await expect(ensureDbUser("clerk-1", FALLBACK)).resolves.toEqual(ROW)
    expect(findUniqueMock).toHaveBeenCalledTimes(2)
  })

  it("still throws when P2002 was the EMAIL clashing, not a lost race", async () => {
    // No row appears under this clerkId on the re-read, so the email belongs to
    // a different Clerk account. Masking that would hide a real problem.
    findUniqueMock.mockResolvedValue(null)
    createMock.mockRejectedValue(P2002())
    await expect(ensureDbUser("clerk-1", FALLBACK)).rejects.toThrow("Unique constraint failed")
  })

  it("does not swallow unrelated errors", async () => {
    findUniqueMock.mockResolvedValue(null)
    createMock.mockRejectedValue(new Error("connection lost"))
    await expect(ensureDbUser("clerk-1", FALLBACK)).rejects.toThrow("connection lost")
  })
})

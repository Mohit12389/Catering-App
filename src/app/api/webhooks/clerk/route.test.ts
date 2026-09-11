import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const upsertMock = vi.fn()
const deleteMock = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      upsert: (a: any) => upsertMock(a),
      // The route chains .catch() onto delete, so the mock must return a promise.
      delete: (a: any) => { deleteMock(a); return Promise.resolve({}) },
    },
  },
}))

import { Webhook } from "svix"
import { POST } from "./route"

// A Svix signing secret is whsec_ + base64 key material.
const SECRET = "whsec_" + Buffer.from("anchal-test-signing-key-material").toString("base64")

/** Build a request Clerk would send, signed with `secret`. */
function signedRequest(event: unknown, secret = SECRET, overrides: Record<string, string> = {}) {
  const payload = JSON.stringify(event)
  const id = "msg_test_1"
  const timestamp = new Date()
  const signature = new Webhook(secret).sign(id, timestamp, payload)

  const headers = new Headers({
    "svix-id": id,
    "svix-timestamp": Math.floor(timestamp.getTime() / 1000).toString(),
    "svix-signature": signature,
    ...overrides,
  })
  return { method: "POST", headers, text: async () => payload } as any
}

const USER_CREATED = {
  type: "user.created",
  data: { id: "user_abc", email_addresses: [{ email_address: "a@b.com" }], first_name: "A", last_name: "B" },
}
const USER_DELETED = { type: "user.deleted", data: { id: "user_abc" } }

beforeEach(() => {
  upsertMock.mockReset()
  deleteMock.mockReset()
  vi.spyOn(console, "error").mockImplementation(() => {})
  process.env.CLERK_WEBHOOK_SECRET = SECRET
})
afterEach(() => { delete process.env.CLERK_WEBHOOK_SECRET })

describe("POST /api/webhooks/clerk", () => {
  // THE HOLE THIS CLOSES: this route is public and user.deleted cascades through
  // every User relation, so an unsigned request could wipe a whole business.
  it("refuses an UNSIGNED user.deleted without touching the database", async () => {
    const res = await POST({
      method: "POST",
      headers: new Headers(),
      text: async () => JSON.stringify(USER_DELETED),
    } as any)
    expect(res.status).toBe(400)
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it("refuses a request signed with the WRONG secret", async () => {
    const wrong = "whsec_" + Buffer.from("some-other-attackers-key-material").toString("base64")
    const res = await POST(signedRequest(USER_DELETED, wrong))
    expect(res.status).toBe(400)
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it("refuses a valid signature attached to a TAMPERED body", async () => {
    // Sign one payload, then send a different one with that signature.
    const real = signedRequest(USER_CREATED)
    const tampered = { ...real, text: async () => JSON.stringify(USER_DELETED) }
    const res = await POST(tampered)
    expect(res.status).toBe(400)
    expect(deleteMock).not.toHaveBeenCalled()
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it("refuses when the signature header is missing but the others are present", async () => {
    const req = signedRequest(USER_DELETED)
    req.headers.delete("svix-signature")
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it("refuses everything when CLERK_WEBHOOK_SECRET is not configured", async () => {
    delete process.env.CLERK_WEBHOOK_SECRET
    const res = await POST(signedRequest(USER_CREATED))
    // Fails CLOSED: a missing secret must not mean "skip the check".
    expect(res.status).toBe(500)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it("accepts a properly signed user.created and syncs the row", async () => {
    const res = await POST(signedRequest(USER_CREATED))
    expect(res.status).toBe(200)
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clerkId: "user_abc" } })
    )
  })

  it("accepts a properly signed user.deleted", async () => {
    const res = await POST(signedRequest(USER_DELETED))
    expect(res.status).toBe(200)
    expect(deleteMock).toHaveBeenCalledWith({ where: { clerkId: "user_abc" } })
  })

  it("ignores a signed user.created that carries no email", async () => {
    const res = await POST(signedRequest({ type: "user.created", data: { id: "user_x", email_addresses: [] } }))
    expect(res.status).toBe(200)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it("ignores event types it does not handle", async () => {
    const res = await POST(signedRequest({ type: "session.created", data: { id: "sess_1" } }))
    expect(res.status).toBe(200)
    expect(upsertMock).not.toHaveBeenCalled()
    expect(deleteMock).not.toHaveBeenCalled()
  })
})

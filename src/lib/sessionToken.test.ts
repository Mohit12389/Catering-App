import { describe, it, expect, beforeEach } from "vitest"
import { signSessionToken, verifySessionToken } from "./sessionToken"

// CHANGED: own login (2026-10-28). The login cookie is the only thing between the
// internet and the business's data, so: a real token works; anything edited, signed
// with another secret, or missing does not.
describe("login cookie token", () => {
  beforeEach(() => { process.env.AUTH_SECRET = "test-secret-one" })

  it("gives back the user id it was signed for", async () => {
    expect(await verifySessionToken(await signSessionToken("user-1"))).toBe("user-1")
  })

  it("rejects a missing or junk cookie", async () => {
    expect(await verifySessionToken(undefined)).toBeNull()
    expect(await verifySessionToken("")).toBeNull()
    expect(await verifySessionToken("not-a-token")).toBeNull()
  })

  it("rejects a token that was edited", async () => {
    const token = await signSessionToken("user-1")
    const [h, , sig] = token.split(".")
    const forged = Buffer.from(JSON.stringify({ sub: "owner-id" })).toString("base64url")
    expect(await verifySessionToken(`${h}.${forged}.${sig}`)).toBeNull()
  })

  it("rejects a token signed with a different secret (changing AUTH_SECRET logs everyone out)", async () => {
    const token = await signSessionToken("user-1")
    process.env.AUTH_SECRET = "test-secret-two"
    expect(await verifySessionToken(token)).toBeNull()
  })
})

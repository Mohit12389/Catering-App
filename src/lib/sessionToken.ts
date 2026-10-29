// =============================================
// LOGIN COOKIE TOKEN (own login, replaced Clerk 2026-10-28)
// =============================================
// CHANGED: new file. The login cookie holds a signed token saying "this browser is
// User.id X". Signed with AUTH_SECRET, so it can't be faked or edited; it expires after
// SESSION_DAYS. Changing AUTH_SECRET logs everyone out.
//
// Only `jose` here (no next/headers, no Prisma) because middleware imports it and
// middleware runs on Vercel's Edge runtime.

import { SignJWT, jwtVerify } from "jose"

export const SESSION_COOKIE = "ac_session"
export const SESSION_DAYS = 30

function secretKey() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET is not set")
  return new TextEncoder().encode(secret)
}

/** A signed token for this user id (User.id, not a Clerk id). */
export async function signSessionToken(userId: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey())
}

/** The user id inside a valid token; null when missing, expired, edited or unsigned. */
export async function verifySessionToken(token: string | undefined | null): Promise<string | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] })
    return typeof payload.sub === "string" && payload.sub ? payload.sub : null
  } catch {
    return null
  }
}

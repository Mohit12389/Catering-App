// =============================================
// SIGNED-IN USER (own login, replaced Clerk 2026-10-28)
// =============================================
// CHANGED: new file, the replacement for Clerk's auth(). `auth()` keeps Clerk's shape
// ({ userId }) so withAuth and the pages barely changed — but userId is now the
// database User.id, not a Clerk id. Data is owned by User.id, so the same email logs
// into the same row and sees the same events.

import { cookies } from "next/headers"
import bcrypt from "bcryptjs"
import { SESSION_COOKIE, SESSION_DAYS, signSessionToken, verifySessionToken } from "@/lib/sessionToken"

export async function auth(): Promise<{ userId: string | null }> {
  return { userId: await verifySessionToken(cookies().get(SESSION_COOKIE)?.value) }
}

/** Log this browser in as `userId` (call from a route handler). */
export async function startSession(userId: string) {
  cookies().set(SESSION_COOKIE, await signSessionToken(userId), {
    httpOnly: true,                                  // page scripts can't read it
    secure: process.env.NODE_ENV === "production",   // https only on Vercel
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

export function endSession() {
  cookies().delete(SESSION_COOKIE)
}

// Passwords are stored only as a bcrypt hash, never as typed.
export const MIN_PASSWORD_LENGTH = 6
export const hashPassword = (password: string) => bcrypt.hash(password, 10)
export const checkPassword = (password: string, hash: string) => bcrypt.compare(password, hash)

/** Emails are compared lower-cased and trimmed everywhere. */
export const normalizeEmail = (email: unknown) => (typeof email === "string" ? email.trim().toLowerCase() : "")

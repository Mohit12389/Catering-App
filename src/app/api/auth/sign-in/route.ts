// CHANGED: new route — own email + password login (replaced Clerk, 2026-10-28).
// Finds the user row by EMAIL — the same row Clerk used, so the same events/bills —
// checks the password against its bcrypt hash and sets the login cookie.
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { startSession, checkPassword, normalizeEmail } from "@/lib/session"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = normalizeEmail(body.email)
    const password = typeof body.password === "string" ? body.password : ""
    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Enter your email and password" }, { status: 400 })
    }

    // Case-insensitive: emails saved by Clerk may not be lower-case.
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, passwordHash: true }
    })

    if (user && !user.passwordHash) {
      // An account from the Clerk days that hasn't had a password set yet.
      return NextResponse.json({
        success: false,
        error: "No password is set for this account yet. Ask the owner to set one (Settings → Staff)."
      }, { status: 401 })
    }
    if (!user || !user.passwordHash || !(await checkPassword(password, user.passwordHash))) {
      return NextResponse.json({ success: false, error: "Wrong email or password" }, { status: 401 })
    }

    await startSession(user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[POST /api/auth/sign-in]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

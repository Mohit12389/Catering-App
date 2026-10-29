// CHANGED: new route — own sign-up (replaced Clerk, 2026-10-28). Creates the user row
// (no role yet) and logs them in; the existing onboarding then asks Owner or Staff,
// exactly as it did after a Clerk sign-up.
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { startSession, hashPassword, normalizeEmail, MIN_PASSWORD_LENGTH } from "@/lib/session"
import { isUniqueViolation } from "@/lib/utils"

const EXISTS = "An account with this email already exists. Sign in instead."

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const email = normalizeEmail(body.email)
    const password = typeof body.password === "string" ? body.password : ""

    if (!name) return NextResponse.json({ success: false, error: "Enter your name" }, { status: 400 })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: "Enter a valid email" }, { status: 400 })
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json({ success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }, { status: 400 })
    }

    // An existing account (incl. one from the Clerk days with no password yet) can NOT
    // be claimed here — otherwise anyone knowing the email could take over its data.
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true }
    })
    if (existing) return NextResponse.json({ success: false, error: EXISTS }, { status: 409 })

    const user = await prisma.user.create({
      data: { email, name, passwordHash: await hashPassword(password) },
      select: { id: true }
    })
    await startSession(user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (isUniqueViolation(error)) return NextResponse.json({ success: false, error: EXISTS }, { status: 409 })
    console.error("[POST /api/auth/sign-up]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// CHANGED: new route — own login (2026-10-28). The owner sets / resets the password of
// one of THEIR staff (Settings → Staff Management). There is no "forgot password"
// email, so this is how a staff member gets back in.
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/withAuth"
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/session"

// Same rule as the staff route: role === "owner" (stricter than ownerOnly), and
// dbUser.id — never effectiveUserId.
export const POST = withAuth(async (req: NextRequest, { dbUser }) => {
  if (dbUser.role !== "owner") {
    return NextResponse.json({ success: false, error: "Only owners can set staff passwords" }, { status: 403 })
  }

  const { staffId, password } = await req.json().catch(() => ({}))
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }, { status: 400 })
  }

  // Only a staff member linked to THIS owner — not any user by id.
  const staff = await prisma.user.findFirst({
    where: { id: typeof staffId === "string" ? staffId : "", ownerId: dbUser.id, role: "staff" },
    select: { id: true }
  })
  if (!staff) {
    return NextResponse.json({ success: false, error: "Staff member not found" }, { status: 404 })
  }

  await prisma.user.update({ where: { id: staff.id }, data: { passwordHash: await hashPassword(password) } })
  return NextResponse.json({ success: true })
})

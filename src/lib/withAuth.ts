// =============================================
// AUTHENTICATED ROUTE WRAPPER
// =============================================
// CHANGED: extracted the preamble that was repeated in ~45 route handlers
// (53 auth() calls, 45 clerkId lookups, 53 "Unauthorized" literals, 39
// "User not found", 50 identical catch blocks, 13 hand-rolled staff 403s).
//
// The point is NOT the line count — it is that "staff must not see billing"
// becomes a DECLARED property of the route (`{ ownerOnly: true }`) instead of an
// if-statement each new endpoint has to remember to write. Forgetting it is then
// visible in the signature rather than invisible in the body.
//
// Handlers receive `effectiveUserId` already resolved, so a route cannot
// accidentally scope a query by dbUser.id when it should use the owner's id.

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { getEffectiveUserId } from "@/lib/getEffectiveUserId"

export interface AuthedUser {
  id: string
  role: string | null
  ownerId: string | null
}

export interface AuthContext {
  /** The signed-in user's own DB row (id/role/ownerId only). */
  dbUser: AuthedUser
  /** Owner's id for staff, own id for owners. Scope ALL user-data queries by this. */
  effectiveUserId: string
  /** Clerk user id. */
  clerkId: string
}

export function withAuth<TCtx = unknown>(
  handler: (req: NextRequest, authCtx: AuthContext, ctx: TCtx) => Promise<NextResponse>,
  opts: {
    /** Staff get a 403. Use for billing / revenue / procurement / cost data. */
    ownerOnly?: boolean
    /**
     * Response when the Clerk user has no DB row yet (the webhook may not have
     * synced). Defaults to 404. Some list endpoints deliberately return an empty
     * 200 instead so a brand-new account renders an empty page, not an error.
     */
    onMissingUser?: () => NextResponse
  } = {}
) {
  return async (req: NextRequest, ctx: TCtx): Promise<NextResponse> => {
    try {
      const { userId } = await auth()
      if (!userId) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
      }

      const dbUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true, role: true, ownerId: true }
      })
      if (!dbUser) {
        return opts.onMissingUser
          ? opts.onMissingUser()
          : NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
      }

      if (opts.ownerOnly && dbUser.role === "staff") {
        return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
      }

      return await handler(
        req,
        { dbUser, effectiveUserId: getEffectiveUserId(dbUser), clerkId: userId },
        ctx
      )
    } catch (error) {
      // Keep the path in the log line — the per-route messages this replaced
      // ("Error fetching advance payments:") were the only diagnostic before.
      let path = req.url
      try { path = new URL(req.url).pathname } catch { /* non-absolute url in tests */ }
      console.error(`[${req.method} ${path}]`, error)
      return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
    }
  }
}

// =============================================
// FIRST-VISIT USER ROW
// =============================================
// CHANGED: extracted from (dashboard)/layout.tsx and (dashboard)/dashboard/page.tsx,
// which each ran their own `prisma.user.upsert({ where: { clerkId }, update: {} })`.
//
// A layout and its child page render CONCURRENTLY in the App Router, so on an
// account's first ever load of /dashboard both of those ran at the same time.
// With an empty `update` Prisma cannot compile the upsert to Postgres' native
// INSERT ... ON CONFLICT DO UPDATE (there is nothing to SET), so it falls back
// to find-then-insert — neither call saw a row, both inserted, and the loser
// crashed the page with P2002 on clerkId. The Clerk user.created webhook is a
// third writer that can race the same way.
//
// The fix is to make creation idempotent rather than to try to order the
// writers: "someone else inserted first" is a success, not an error.

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export async function ensureDbUser(
  clerkId: string,
  fallback: { email: string; name: string | null }
) {
  const existing = await prisma.user.findUnique({ where: { clerkId } })
  if (existing) return existing

  try {
    return await prisma.user.create({
      data: { clerkId, email: fallback.email, name: fallback.name }
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Lost the insert race — re-read the row the winner wrote.
      const raced = await prisma.user.findUnique({ where: { clerkId } })
      if (raced) return raced
      // Still nothing under this clerkId, so the clash was on the OTHER unique
      // column, `email`: this email already belongs to a different Clerk
      // account. That is a real problem, not a race — let it surface.
    }
    throw error
  }
}

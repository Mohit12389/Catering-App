// =============================================
// SIGNED-IN USER FOR (dashboard) SERVER COMPONENTS
// =============================================
// CHANGED: (dashboard)/layout.tsx and dashboard/page.tsx each called currentUser()
// (an HTTP call to Clerk's API, not cached by Clerk) and ensureDbUser() — so every
// /dashboard load paid for TWO Clerk calls and two user lookups. React's cache()
// shares one result between every server component of the SAME request, so the
// layout and the page now get one call between them. It never shares across
// requests or users.

import { cache } from "react"
import { auth, currentUser } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { ensureDbUser } from "@/lib/ensureDbUser"

export const getDashboardUser = cache(async () => {
  const { userId } = await auth()
  if (!userId) return null

  const clerkUser = await currentUser()
  const dbUser = await ensureDbUser(userId, {
    email: clerkUser?.emailAddresses?.[0]?.emailAddress || 'unknown@email.com',
    name: clerkUser?.firstName || null,
  })

  // Staff inherit the owner's business name (they have none of their own).
  let displayOrgName = dbUser.organizationName
  if (dbUser.role === "staff" && dbUser.ownerId) {
    const owner = await prisma.user.findUnique({
      where: { id: dbUser.ownerId },
      select: { organizationName: true }
    })
    if (owner?.organizationName) displayOrgName = owner.organizationName
  }

  return { userId, clerkUser, dbUser, displayOrgName }
})

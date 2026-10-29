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
import { auth } from "@/lib/session" // CHANGED: own login replaced Clerk — no Clerk API call any more
import { prisma } from "@/lib/prisma"

export const getDashboardUser = cache(async () => {
  const { userId } = await auth()
  if (!userId) return null

  // CHANGED: was currentUser() (an HTTP call to Clerk) + ensureDbUser(). The login
  // cookie now holds User.id and sign-up creates the row, so this is one DB lookup.
  // passwordHash deliberately NOT selected — this row is handed to the layout.
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, ownerId: true, organizationName: true }
  })
  if (!dbUser) return null // cookie for a deleted user → layout sends them to sign-in

  // Staff inherit the owner's business name (they have none of their own).
  let displayOrgName = dbUser.organizationName
  if (dbUser.role === "staff" && dbUser.ownerId) {
    const owner = await prisma.user.findUnique({
      where: { id: dbUser.ownerId },
      select: { organizationName: true }
    })
    if (owner?.organizationName) displayOrgName = owner.organizationName
  }

  return { userId, dbUser, displayOrgName } // CHANGED: - clerkUser
})

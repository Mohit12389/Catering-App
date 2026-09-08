import { redirect } from "next/navigation"
import { auth, currentUser } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { ensureDbUser } from "@/lib/ensureDbUser" // CHANGED: shared, race-safe first-visit user creation
import { Navbar } from "@/components/layout"
import { ConfirmProvider } from "@/components/shared"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  const user = await currentUser()

  // Get or create database user.
  // CHANGED: was findUnique + upsert({ update: {} }) inline. That upsert is not
  // atomic (empty update => Prisma cannot use INSERT ... ON CONFLICT), and this
  // layout renders CONCURRENTLY with dashboard/page.tsx, which ran the very same
  // upsert — so an account's first load had both inserting and the loser died
  // with P2002 on clerkId. ensureDbUser treats that collision as success.
  const dbUser = await ensureDbUser(userId, {
    email: user?.emailAddresses?.[0]?.emailAddress || 'unknown@email.com',
    name: user?.firstName || null,
  })

  // CHANGED: redirect unlinked staff to onboarding (waiting screen).
  // This used to be a no-op to avoid a redirect loop, back when /onboarding
  // was inside this same (dashboard) route group/layout — redirecting there
  // re-ran this same check and looped. Now that /onboarding lives outside
  // this layout, redirecting here is safe and staff can no longer wander
  // into dashboard pages with no data before an owner has added them.
  if (dbUser.role === "staff" && !dbUser.ownerId) {
    redirect("/onboarding")
  }

  // Owner without org name needs onboarding
  if (dbUser.role !== "staff" && !dbUser.organizationName) {
    redirect("/onboarding")
  }

  // CHANGED: For staff with an owner, get the owner's organizationName for navbar display
  let displayOrgName = dbUser.organizationName
  if (dbUser.role === "staff" && dbUser.ownerId) {
    const owner = await prisma.user.findUnique({
      where: { id: dbUser.ownerId },
      select: { organizationName: true }
    })
    if (owner?.organizationName) {
      displayOrgName = owner.organizationName
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        userName={user?.firstName || user?.username} 
        userEmail={user?.emailAddresses[0]?.emailAddress}
        organizationName={displayOrgName}
        userRole={dbUser.role}    // CHANGED: Pass role to Navbar
      />
      <main className="container py-8">
         <ConfirmProvider>
           {children}
         </ConfirmProvider>
      </main>
    </div>
  )
}
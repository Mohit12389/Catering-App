import { redirect } from "next/navigation"
import { auth, currentUser } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
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

  // Get or create database user
  let dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { 
      id: true, 
      organizationName: true,
      name: true,
      email: true,
      role: true,       // CHANGED: Added role
      ownerId: true     // CHANGED: Added ownerId
    }
  })

  // Create user if doesn't exist
  // CHANGED: use upsert instead of create — the Clerk webhook (user.created)
  // can race this and insert the same clerkId first; create() would then
  // throw a unique-constraint error and crash the page for new sign-ins.
  // upsert makes this a no-op when the webhook already created the row.
  if (!dbUser) {
    dbUser = await prisma.user.upsert({
      where: { clerkId: userId },
      update: {},
      create: {
        clerkId: userId,
        email: user?.emailAddresses?.[0]?.emailAddress || 'unknown@email.com',
        name: user?.firstName || null,
      },
      select: {
        id: true,
        organizationName: true,
        name: true,
        email: true,
        role: true,       // CHANGED: Added role
        ownerId: true     // CHANGED: Added ownerId
      }
    })
  }

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
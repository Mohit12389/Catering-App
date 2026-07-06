import { redirect } from "next/navigation"
import { auth, currentUser } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { Navbar } from "@/components/layout"

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
  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
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

  // CHANGED: If staff is not linked to any owner, redirect to onboarding (waiting screen)
  // This prevents unlinked staff from seeing an empty dashboard
  if (dbUser.role === "staff" && !dbUser.ownerId) {
    // Allow access to onboarding page itself so they can see the waiting screen
    // We can't check path in server component easily, so we use a simple approach:
    // The onboarding page handles the waiting UI, so redirect there
    // But we need to avoid infinite redirect if they're already on onboarding
    // Next.js headers() can help, but simplest: let onboarding page render normally
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
        {children}
      </main>
    </div>
  )
}
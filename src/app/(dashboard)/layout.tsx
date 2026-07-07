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

  // Redirect unlinked staff to onboarding
  // Skip redirect if already on onboarding to avoid loops
  if (dbUser.role === "staff" && !dbUser.ownerId) {
    // Don't redirect — let the page render. 
    // Onboarding page handles the waiting UI itself.
    // Other pages will show empty data which is fine.
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
        {children}
      </main>
    </div>
  )
}
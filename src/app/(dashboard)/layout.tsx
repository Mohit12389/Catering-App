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
      email: true
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
        email: true
      }
    })
  }

  // Check if user needs to set up organization (skip for onboarding page)
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
  
  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        userName={user?.firstName || user?.username} 
        userEmail={user?.emailAddresses[0]?.emailAddress}
        organizationName={dbUser.organizationName}
      />
      <main className="container py-8">
        {children}
      </main>
    </div>
  )
}

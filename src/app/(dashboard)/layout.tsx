import { redirect } from "next/navigation"
import { getDashboardUser } from "@/lib/getDashboardUser" // CHANGED: one Clerk call + user lookup per request, shared with dashboard/page.tsx
import { Navbar } from "@/components/layout"
import { ConfirmProvider, CurrentUserProvider } from "@/components/shared" // CHANGED: + CurrentUserProvider

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // CHANGED: auth + currentUser + ensureDbUser + staff's owner-name lookup moved into
  // getDashboardUser (React cache), because dashboard/page.tsx ran the same calls
  // again in the same request. ensureDbUser is still the race-safe creator.
  const me = await getDashboardUser()

  if (!me) {
    redirect("/sign-in")
  }

  const { clerkUser: user, dbUser, displayOrgName } = me

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

  // CHANGED: staff's owner-name lookup now lives in getDashboardUser (displayOrgName).

  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        userName={user?.firstName || user?.username} 
        userEmail={user?.emailAddresses[0]?.emailAddress}
        organizationName={displayOrgName}
        userRole={dbUser.role}    // CHANGED: Pass role to Navbar
      />
      <main className="container py-8">
         {/* CHANGED: pages read role/org name from here instead of fetching /api/user/organization */}
         <CurrentUserProvider user={{ id: dbUser.id, role: dbUser.role, organizationName: displayOrgName }}>
           <ConfirmProvider>
             {children}
           </ConfirmProvider>
         </CurrentUserProvider>
      </main>
    </div>
  )
}
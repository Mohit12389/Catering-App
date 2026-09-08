import Link from "next/link"
import { auth, currentUser } from "@clerk/nextjs/server" // CHANGED: currentUser replaces a hand-rolled Clerk REST call
import { prisma } from "@/lib/prisma"
import { getEffectiveUserId } from "@/lib/getEffectiveUserId"  // CHANGED: staff must see owner's data, not their own
import { ensureDbUser } from "@/lib/ensureDbUser"  // CHANGED: shared, race-safe first-visit user creation
import { 
  CalendarDays, 
  CalendarPlus, 
  UtensilsCrossed, 
  Settings,
  Users,
  ChefHat,
  Package,
  TrendingUp,
  Receipt,
  BarChart3,
  Building2
} from "lucide-react"

export default async function DashboardPage() {
  const { userId } = await auth()

  // CHANGED: was a hand-rolled `fetch("https://api.clerk.com/v1/users/<id>")`
  // carrying CLERK_SECRET_KEY in a header, run on EVERY dashboard load. That is
  // an extra outbound round-trip per page view, and its `.catch(() => null)`
  // meant a momentary Clerk failure created the row as 'unknown@email.com' —
  // which, because User.email is @unique, turned into a permanent P2002 the
  // second time it happened. currentUser() is the supported reader and is what
  // (dashboard)/layout.tsx already uses.
  const clerkUser = await currentUser()

  // CHANGED: was an inline upsert({ update: {} }), which is not atomic and ran
  // concurrently with the identical one in (dashboard)/layout.tsx — on an
  // account's first load both inserted and one died with P2002 on clerkId.
  const dbUser = await ensureDbUser(userId!, {
    email: clerkUser?.emailAddresses?.[0]?.emailAddress || 'unknown@email.com',
    name: clerkUser?.firstName || null,
  })

  // CHANGED: removed the duplicated `!organizationName && role !== "staff"`
  // redirect to /onboarding. (dashboard)/layout.tsx already makes that exact
  // decision, plus the broader one for staff with no ownerId, and this page
  // cannot render without that layout. Two copies of an onboarding rule is
  // precisely what breaks when a new user type is added — the layout is the
  // single place that decision lives.

  // Get stats - filtered by effective userId (staff see owner's data)
  const effectiveUserId = getEffectiveUserId(dbUser)  // CHANGED: was dbUser.id — always empty for staff
  const [totalEvents, activeEvents, menuItems, ingredients] = await Promise.all([
    prisma.event.count({ where: { userId: effectiveUserId } }),
    prisma.event.count({ where: { userId: effectiveUserId, status: 'active' } }),
    prisma.item.count({ where: { userId: effectiveUserId } }),
    prisma.ingredient.count({ where: { userId: effectiveUserId } }),
  ])

  const stats = [
    { label: "Total Events", value: totalEvents, icon: CalendarDays, color: "bg-blue-100 text-blue-600" },
    { label: "Active Events", value: activeEvents, icon: TrendingUp, color: "bg-green-100 text-green-600" },
    { label: "Menu Items", value: menuItems, icon: ChefHat, color: "bg-amber-100 text-amber-600" },
    { label: "Ingredients", value: ingredients, icon: Package, color: "bg-purple-100 text-purple-600" },
  ]

  const quickActions = [
    { href: "/create-event", label: "Create Event", labelHi: "इवेंट बनाएं", icon: CalendarPlus, color: "bg-primary" },
    { href: "/event-menu", label: "Event Menu", labelHi: "इवेंट मेन्यू", icon: UtensilsCrossed, color: "bg-secondary" },
    { href: "/billing", label: "Create Bill", labelHi: "बिल बनाएं", icon: Receipt, color: "bg-amber-500" },
    { href: "/billing/stats", label: "Revenue Stats", labelHi: "राजस्व आँकड़े", icon: BarChart3, color: "bg-emerald-500" },
    { href: "/customize-inventory", label: "Customize Inventory", labelHi: "इन्वेंटरी अनुकूलित करें", icon: Settings, color: "bg-accent" },
    { href: "/event-history", label: "Event History", labelHi: "इवेंट इतिहास", icon: CalendarDays, color: "bg-muted" },
  ]

  return (
    <div className="space-y-8 animate-in">
      {/* Welcome Section */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Building2 className="w-4 h-4" />
          {dbUser.organizationName}
        </div>
        <h1 className="text-3xl font-bold">
          Welcome back{dbUser.name ? `, ${dbUser.name}` : ''}! 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your catering events and inventory / अपने केटरिंग इवेंट्स और इन्वेंटरी प्रबंधित करें
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid-4">
        {stats.map((stat, index) => (
          <div key={stat.label} className={`stat-card stagger-${index + 1}`}>
            <div className={`stat-icon ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Quick Actions / त्वरित कार्य</h2>
        <div className="grid-4">
          {quickActions.map((action, index) => (
            <Link
              key={action.href}
              href={action.href}
              className={`card-hover flex flex-col items-center text-center p-6 stagger-${index + 1}`}
            >
              <div className={`w-14 h-14 rounded-xl ${action.color} flex items-center justify-center mb-4`}>
                <action.icon className="w-7 h-7 text-primary-foreground" />
              </div>
              <h3 className="font-semibold">{action.label}</h3>
              <p className="text-xs text-muted-foreground mt-1">{action.labelHi}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
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

  // Get or create user from database using upsert to avoid duplicate errors
  const clerkUser = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
  }).then(r => r.json()).catch(() => null)

  const dbUser = await prisma.user.upsert({
    where: { clerkId: userId! },
    update: {},
    create: {
      clerkId: userId!,
      email: clerkUser?.email_addresses?.[0]?.email_address || 'unknown@email.com',
      name: clerkUser?.first_name || null,
    },
  })

  // Redirect to onboarding if no organization name set
  if (!dbUser.organizationName) {
    redirect("/onboarding")
  }

  // Get stats - filtered by userId
  const [totalEvents, activeEvents, menuItems, ingredients] = await Promise.all([
    prisma.event.count({ where: { userId: dbUser.id } }),
    prisma.event.count({ where: { userId: dbUser.id, status: 'active' } }),
    prisma.item.count({ where: { userId: dbUser.id } }),
    prisma.ingredient.count({ where: { userId: dbUser.id } }),
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

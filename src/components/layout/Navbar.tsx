"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton } from "@clerk/nextjs"
import { 
  LayoutDashboard, 
  CalendarPlus, 
  UtensilsCrossed, 
  Settings, 
  History,
  ChefHat,
  Printer,
  Receipt,
  Building2
} from "lucide-react"
import { cn } from "@/lib/utils"

// =============================================
// ROLE-BASED ACCESS: Nav items with role restrictions
// =============================================
// CHANGED: Added `ownerOnly` flag to items that staff cannot access
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create-event", label: "Create", icon: CalendarPlus },
  { href: "/event-menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/customize-inventory", label: "Inventory", icon: Settings },
  { href: "/event-history", label: "History", icon: History },
  { href: "/billing", label: "Billing", icon: Receipt, ownerOnly: true },          // CHANGED: owner only
  { href: "/categories-print", label: "Print", icon: Printer },
  { href: "/settings", label: "Settings", icon: Building2, ownerOnly: true },       // CHANGED: owner only
]

interface NavbarProps {
  userName?: string | null
  userEmail?: string | null
  organizationName?: string | null
  userRole?: string | null   // CHANGED: Added role prop
}

// CHANGED: Added userRole to props
export function Navbar({ userName, userEmail, organizationName, userRole }: NavbarProps) {
  const pathname = usePathname()

  // Split organization name for display
  const orgParts = organizationName?.split(' ') || ['Your', 'Business']
  const orgMain = orgParts[0] || 'Your'
  const orgSub = orgParts.slice(1).join(' ') || 'CATERERS'

  // CHANGED: Filter nav items based on role — staff cannot see ownerOnly items
  const visibleNavItems = navItems.filter(item => {
    if (item.ownerOnly && userRole === "staff") return false
    return true
  })

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 print:hidden">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo with Organization Name */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <ChefHat className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold text-primary">{orgMain}</h1>
            <p className="text-xs text-muted-foreground -mt-1 uppercase">{orgSub || 'CATERERS'}</p>
          </div>
        </Link>

        {/* Navigation — CHANGED: uses visibleNavItems instead of navItems */}
        <nav className="hidden md:flex items-center gap-1">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "nav-link",
                  isActive && "nav-link-active"
                )}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium">{userName || 'User'}</p>
            <p className="text-xs text-muted-foreground">{userEmail}</p>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      {/* Mobile Navigation — CHANGED: uses visibleNavItems */}
      <nav className="md:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto">
        {visibleNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "nav-link whitespace-nowrap text-xs",
                isActive && "nav-link-active"
              )}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
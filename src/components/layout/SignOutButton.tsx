"use client"

// CHANGED: new file (own login replaced Clerk, 2026-10-28). Replaces Clerk's
// <UserButton> / <SignOutButton>: clears the login cookie, then a FULL page load to
// /sign-in so nothing from the signed-in session stays in memory.
import { useState } from "react"
import { LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

export function SignOutButton({ className, label = "Sign out" }: { className?: string; label?: string }) {
  const [busy, setBusy] = useState(false)
  const signOut = async () => {
    setBusy(true)
    try {
      await fetch("/api/auth/sign-out", { method: "POST" })
    } finally {
      window.location.replace("/sign-in")
    }
  }
  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      title="Sign out"
      className={cn("inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50", className)}
    >
      <LogOut className="w-4 h-4" />
      <span>{label}</span>
    </button>
  )
}

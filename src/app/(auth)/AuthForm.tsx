"use client"

// CHANGED: new file — the sign-in / sign-up form (own login replaced Clerk's <SignIn />
// and <SignUp />, 2026-10-28).
import { useState } from "react"
import Link from "next/link"
import { ChefHat } from "lucide-react"
import { Button, Input } from "@/components/ui"

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const isSignUp = mode === "sign-up"
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setBusy(true)
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isSignUp ? { name, email, password } : { email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        setError(data.error || "Something went wrong, please try again")
        setBusy(false)
        return
      }
      // Back to the page that sent us here (only a path on this site), else the dashboard.
      // A full page load so the layout reads the new login cookie.
      const next = new URLSearchParams(window.location.search).get("next")
      window.location.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard")
    } catch {
      setError("Could not reach the server, check the internet and try again")
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-card border rounded-xl shadow-sm p-6 space-y-4">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-primary mx-auto flex items-center justify-center">
            <ChefHat className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold">{isSignUp ? "Create account" : "Sign in"}</h1>
          <p className="text-sm text-muted-foreground">Anchal Caterers</p>
        </div>

        {isSignUp && (
          <Input label="Name / नाम" value={name} onChange={e => setName(e.target.value)} autoComplete="name" required />
        )}
        <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required autoFocus={!isSignUp} />
        <Input
          label="Password / पासवर्ड"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete={isSignUp ? "new-password" : "current-password"}
          required
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Please wait..." : isSignUp ? "Create account" : "Sign in"}
        </Button>

        <p className="text-sm text-center text-muted-foreground">
          {isSignUp
            ? <>Already have an account? <Link href="/sign-in" className="text-primary hover:underline">Sign in</Link></>
            : <>New staff member? <Link href="/sign-up" className="text-primary hover:underline">Create account</Link></>}
        </p>
      </form>
    </main>
  )
}

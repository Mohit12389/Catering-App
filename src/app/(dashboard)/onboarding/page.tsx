"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Building2, ChefHat, ArrowRight, Users, User } from "lucide-react"
import { Button, Input } from "@/components/ui"
import { Card, CardHeader, CardTitle, CardContent, Loading } from "@/components/shared"
import { useToast } from "@/hooks/useToast"

export default function OnboardingPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [step, setStep] = useState<"role" | "orgName" | "staffWaiting">("role")
  const [selectedRole, setSelectedRole] = useState<"owner" | "staff" | null>(null)
  const [organizationName, setOrganizationName] = useState("")
  const [loading, setLoading] = useState(false)

  // CHANGED: Check if user is already set up — redirect if so
  const [checkingStatus, setCheckingStatus] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetch("/api/user/organization")
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        if (data.success) {
          const user = data.data
          // Already set up — redirect to dashboard
          if ((user.role === "owner" && user.organizationName) ||
              (user.role === "staff" && user.ownerId)) {
            window.location.replace("/dashboard")
            return
          }
          // Staff without owner — show waiting screen
          if (user.role === "staff" && !user.ownerId) {
            setStep("staffWaiting")
          }
          // Owner without org name — show org name form
          if (user.role === "owner" && !user.organizationName) {
            setStep("orgName")
            setSelectedRole("owner")
          }
        }
        setCheckingStatus(false)
      })
      .catch(() => {
        if (!cancelled) setCheckingStatus(false)
      })

    return () => { cancelled = true }
  }, [])

  // Handle role selection
  const handleRoleSelect = async (role: "owner" | "staff") => {
    setSelectedRole(role)
    
    if (role === "staff") {
      // Staff: just save role, show waiting screen
      setLoading(true)
      try {
        const res = await fetch("/api/user/organization", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "staff" })
        })
        const data = await res.json()
        if (data.success) {
          setStep("staffWaiting")
        } else {
          throw new Error(data.error)
        }
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" })
      } finally {
        setLoading(false)
      }
    } else {
      // Owner: go to org name step
      setStep("orgName")
    }
  }

  // Handle owner org name submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organizationName.trim()) {
      toast({ 
        title: "Error", 
        description: "Please enter your organization name", 
        variant: "destructive" 
      })
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/user/organization", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          organizationName: organizationName.trim(),
          role: "owner"
        })
      })

      const data = await res.json()
      if (data.success) {
        toast({ 
          title: "Welcome!", 
          description: `${organizationName} is now set up!` 
        })
        window.location.href = "/dashboard"
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      })
    } finally {
      setLoading(false)
    }
  }

  // Staff waiting screen — check if they've been linked to an owner
  const handleStaffRefresh = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/user/organization")
      const data = await res.json()
      if (data.success && data.data.ownerId) {
        // Staff has been linked to an owner, redirect to dashboard
        toast({ title: "Access Granted!", description: "You've been added to a team." })
        window.location.href = "/dashboard"
      } else {
        toast({ title: "Not yet", description: "Your admin hasn't added you yet. Please wait." })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to check status", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // CHANGED: Show loading while checking user status
  if (checkingStatus) {
    return <Loading text="Checking account..." />
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <ChefHat className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome! 🎉</CardTitle>
          <p className="text-muted-foreground mt-2">
            {step === "role" && "How will you use this app?"}
            {step === "orgName" && "Let's set up your catering business"}
            {step === "staffWaiting" && "Waiting for access"}
          </p>
        </CardHeader>
        <CardContent>

          {/* Step 1 — Role Selection */}
          {step === "role" && (
            <div className="space-y-4">
              <button
                onClick={() => handleRoleSelect("owner")}
                disabled={loading}
                className="w-full p-4 border-2 rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-left space-y-1"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">Business Owner / मालिक</p>
                    <p className="text-sm text-muted-foreground">
                      I run a catering business and want full access
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleRoleSelect("staff")}
                disabled={loading}
                className="w-full p-4 border-2 rounded-lg hover:border-secondary hover:bg-secondary/5 transition-all text-left space-y-1"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">Staff Member / कर्मचारी</p>
                    <p className="text-sm text-muted-foreground">
                      I work for a catering business and was asked to join
                    </p>
                  </div>
                </div>
              </button>

              {loading && (
                <p className="text-sm text-muted-foreground text-center animate-pulse">Setting up...</p>
              )}
            </div>
          )}

          {/* Step 2a — Owner: Organization Name */}
          {step === "orgName" && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Input
                  label="Organization Name / संगठन का नाम"
                  placeholder="e.g., Anchal Caterers"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-2">
                  This name will appear on your invoices and throughout the app
                </p>
              </div>

              <div className="space-y-3">
                <Button 
                  type="submit" 
                  className="w-full" 
                  loading={loading}
                >
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                {/* CHANGED: Only show "go back" if role hasn't been saved yet */}
                {!selectedRole && (
                  <button
                    type="button"
                    onClick={() => { setStep("role"); setSelectedRole(null) }}
                    className="text-xs text-muted-foreground hover:text-foreground w-full text-center"
                  >
                    ← Go back
                  </button>
                )}
              </div>
            </form>
          )}

          {/* Step 2b — Staff: Waiting for owner to add them */}
          {step === "staffWaiting" && (
            <div className="space-y-6 text-center">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <User className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                <p className="text-sm text-amber-800">
                  You're registered as a staff member. Ask your business owner to add your email in their 
                  <strong> Settings → Staff Management</strong> section.
                </p>
              </div>

              <Button 
                onClick={handleStaffRefresh} 
                loading={loading}
                variant="outline"
                className="w-full"
              >
                Check Access Status / जांचें
              </Button>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  )
}
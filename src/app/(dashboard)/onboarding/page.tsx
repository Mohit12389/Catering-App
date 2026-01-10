"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, ChefHat, ArrowRight } from "lucide-react"
import { Button, Input } from "@/components/ui"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/shared"
import { useToast } from "@/hooks/useToast"

export default function OnboardingPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [organizationName, setOrganizationName] = useState("")
  const [loading, setLoading] = useState(false)

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
        body: JSON.stringify({ organizationName: organizationName.trim() })
      })
      
      const data = await res.json()
      
      if (data.success) {
        toast({ 
          title: "Welcome!", 
          description: `${organizationName} is now set up!` 
        })
        router.push("/dashboard")
        router.refresh()
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

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <ChefHat className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome! 🎉</CardTitle>
          <p className="text-muted-foreground mt-2">
            Let's set up your catering business
          </p>
        </CardHeader>
        <CardContent>
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
              
              <p className="text-xs text-center text-muted-foreground">
                You can change this later in settings
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { Building2, Save, User } from "lucide-react"
import { Button, Input } from "@/components/ui"
import { Card, CardHeader, CardTitle, CardContent, Loading } from "@/components/shared"
import { useToast } from "@/hooks/useToast"

interface UserData {
  id: string
  name: string | null
  email: string
  organizationName: string | null
}

export default function SettingsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [organizationName, setOrganizationName] = useState("")

  useEffect(() => {
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    try {
      const res = await fetch("/api/user/organization")
      const data = await res.json()
      if (data.success) {
        setUserData(data.data)
        setOrganizationName(data.data.organizationName || "")
      }
    } catch (error) {
      console.error("Failed to fetch user data")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!organizationName.trim()) {
      toast({ 
        title: "Error", 
        description: "Organization name is required", 
        variant: "destructive" 
      })
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/user/organization", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationName: organizationName.trim() })
      })
      
      const data = await res.json()
      
      if (data.success) {
        setUserData(data.data)
        toast({ 
          title: "Success", 
          description: "Organization updated! Refresh to see changes in navbar." 
        })
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
      setSaving(false)
    }
  }

  if (loading) return <Loading />

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Building2 className="w-8 h-8 text-primary" />
          Settings / सेटिंग्स
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your organization settings
        </p>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Email</label>
            <p className="font-medium">{userData?.email}</p>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Name</label>
            <p className="font-medium">{userData?.name || "Not set"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Organization Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Organization Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Organization Name / संगठन का नाम"
            placeholder="e.g., Anchal Caterers"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            This name will appear in the navbar and on your invoices.
            For best display, use format: "Name Type" (e.g., "Anchal Caterers", "Royal Events")
          </p>

          <Button onClick={handleSave} loading={saving}>
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

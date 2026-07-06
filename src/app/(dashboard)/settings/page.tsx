"use client"

import { useState, useEffect } from "react"
import { Building2, Save, User, Users, Plus, Trash2, Mail, Loader2 } from "lucide-react"
import { Button, Input } from "@/components/ui"
import { Card, CardHeader, CardTitle, CardContent, Loading } from "@/components/shared"
import { useToast } from "@/hooks/useToast"

interface UserData {
  id: string
  name: string | null
  email: string
  organizationName: string | null
  role: string          // CHANGED: Added role
}

// CHANGED: Staff member type
interface StaffMember {
  id: string
  email: string
  name: string | null
  createdAt: string
}

export default function SettingsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [organizationName, setOrganizationName] = useState("")

  // CHANGED: Staff management state
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [newStaffEmail, setNewStaffEmail] = useState("")
  const [addingStaff, setAddingStaff] = useState(false)
  const [removingStaffId, setRemovingStaffId] = useState<string | null>(null)

  useEffect(() => {
    fetchUserData()
  }, [])

  // CHANGED: Also fetch staff list after user data loads
  useEffect(() => {
    if (userData?.role === "owner") {
      fetchStaff()
    }
  }, [userData?.role])

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

  // CHANGED: Fetch staff members
  const fetchStaff = async () => {
    setLoadingStaff(true)
    try {
      const res = await fetch("/api/user/staff")
      const data = await res.json()
      if (data.success) {
        setStaffMembers(data.data)
      }
    } catch (error) {
      console.error("Failed to fetch staff")
    } finally {
      setLoadingStaff(false)
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

  // CHANGED: Add staff member by email
  const handleAddStaff = async () => {
    if (!newStaffEmail.trim()) {
      toast({ title: "Error", description: "Enter staff email", variant: "destructive" })
      return
    }

    setAddingStaff(true)
    try {
      const res = await fetch("/api/user/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newStaffEmail.trim() })
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: "Staff Added!", description: `${data.data.email} can now access your data.` })
        setNewStaffEmail("")
        fetchStaff()
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setAddingStaff(false)
    }
  }

  // CHANGED: Remove staff member
  const handleRemoveStaff = async (staffId: string) => {
    if (!confirm("Remove this staff member? They will lose access to your data.")) return

    setRemovingStaffId(staffId)
    try {
      const res = await fetch(`/api/user/staff?staffId=${staffId}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        toast({ title: "Staff Removed" })
        fetchStaff()
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setRemovingStaffId(null)
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
          {/* CHANGED: Show role */}
          <div>
            <label className="text-sm text-muted-foreground">Role</label>
            <p className="font-medium capitalize">{userData?.role || "owner"}</p>
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

      {/* =============================================
          CHANGED: Staff Management Section (owner only)
          ============================================= */}
      {userData?.role === "owner" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Staff Management / कर्मचारी प्रबंधन
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add staff members by their email. They must sign up first and select "Staff" during onboarding.
              Staff can access everything except Billing, Revenue Analytics, and Settings.
            </p>

            {/* Add Staff Form */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Enter staff email address..."
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === "Enter" && handleAddStaff()}
                />
              </div>
              <Button onClick={handleAddStaff} loading={addingStaff} disabled={!newStaffEmail.trim()}>
                <Plus className="w-4 h-4 mr-1" />Add
              </Button>
            </div>

            {/* Staff List */}
            {loadingStaff ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : staffMembers.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No staff members yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {staffMembers.map((staff) => (
                  <div
                    key={staff.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center">
                        <User className="w-4 h-4 text-secondary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{staff.name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground">{staff.email}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveStaff(staff.id)}
                      loading={removingStaffId === staff.id}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
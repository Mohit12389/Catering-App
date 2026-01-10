"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Phone,
  MapPin,
  ChefHat,
  FileDown,
  Printer,
  Trash2,
  Package,
  CalendarCheck,
  IndianRupee,
  CreditCard,
  Copy
} from "lucide-react"
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui"
import { Card, Loading, Badge } from "@/components/shared"
import { useToast } from "@/hooks/useToast"
import type { Event } from "@/types"
import { formatDate } from "@/lib/utils"

interface GroupedIngredient {
  categoryId: string
  categoryName: string
  ingredients: {
    id: string
    name: string
    unit: string
    quantity: number
  }[]
}

export default function EventHistoryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()

  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  
  // Copy event dialog
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [copying, setCopying] = useState(false)
  const [copyFormData, setCopyFormData] = useState({
    organizerName: "",
    phoneNumber: "",
    location: "",
    functionDate: "",
    functionTime: "",
    guestCount: "",
    perPlatePrice: ""
  })

  useEffect(() => {
    fetchEvent()
  }, [params.eventId])

  const fetchEvent = async () => {
    try {
      const res = await fetch(`/api/events/${params.eventId}`)
      const data = await res.json()
      if (data.success) setEvent(data.data)
    } catch (error) {
      toast({ title: "Error", description: "Failed to load event", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // Group ingredients by category
  const groupedIngredients = useMemo((): GroupedIngredient[] => {
    if (!event?.eventIngredients) return []
    
    const groups: Record<string, GroupedIngredient> = {}
    
    event.eventIngredients.forEach(ei => {
      if (ei.quantity <= 0) return // Skip zero quantity
      
      const catId = ei.ingredient?.category?.id || "uncategorized"
      const catName = ei.ingredient?.category?.name || "Other"
      
      if (!groups[catId]) {
        groups[catId] = { categoryId: catId, categoryName: catName, ingredients: [] }
      }
      
      groups[catId].ingredients.push({
        id: ei.id,
        name: ei.ingredient?.name || "Unknown",
        unit: ei.ingredient?.unit || "",
        quantity: ei.quantity
      })
    })
    
    Object.values(groups).forEach(g => g.ingredients.sort((a, b) => a.name.localeCompare(b.name)))
    return Object.values(groups).sort((a, b) => a.categoryName.localeCompare(b.categoryName))
  }, [event?.eventIngredients])

  const totalIngredients = groupedIngredients.reduce((sum, g) => sum + g.ingredients.length, 0)

  const updateStatus = async (newStatus: string) => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/events/${params.eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      })
      const data = await res.json()
      if (data.success) {
        await fetchEvent()
        toast({ title: "Success", description: `Status updated to ${newStatus}` })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" })
    } finally {
      setUpdating(false)
    }
  }

  const deleteEvent = async () => {
    if (!confirm("Are you sure you want to delete this event?")) return
    try {
      const res = await fetch(`/api/events/${params.eventId}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Success", description: "Event deleted" })
        router.push("/event-history")
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete event", variant: "destructive" })
    }
  }

  const openCopyDialog = () => {
    if (!event) return
    setCopyFormData({
      organizerName: "",
      phoneNumber: "",
      location: event.location,
      functionDate: "",
      functionTime: event.functionTime,
      guestCount: String(event.guestCount),
      perPlatePrice: String(event.perPlatePrice || "")
    })
    setCopyDialogOpen(true)
  }

  const handleCopyEvent = async () => {
    if (!event) return
    
    if (!copyFormData.organizerName || !copyFormData.phoneNumber || !copyFormData.functionDate) {
      toast({ title: "Error", description: "Please fill required fields", variant: "destructive" })
      return
    }
    
    setCopying(true)
    try {
      const res = await fetch("/api/events/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceEventId: event.id,
          ...copyFormData,
          guestCount: parseInt(copyFormData.guestCount) || event.guestCount,
          perPlatePrice: parseFloat(copyFormData.perPlatePrice) || 0
        })
      })
      
      const data = await res.json()
      if (data.success) {
        toast({ title: "Success", description: "Event copied successfully!" })
        setCopyDialogOpen(false)
        router.push(`/event-menu/${data.data.id}`)
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setCopying(false)
    }
  }

  const exportCSV = () => {
    if (!event) return
    let csv = "Category,Ingredient,Quantity,Unit\n"
    groupedIngredients.forEach(g => {
      g.ingredients.forEach(ing => {
        csv += `"${g.categoryName}","${ing.name}",${ing.quantity},"${ing.unit}"\n`
      })
    })
    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${event.eventId}-ingredients.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    toast({ title: "Success", description: "CSV exported" })
  }

  const printEvent = () => window.print()

  if (loading) return <Loading text="Loading event..." />

  if (!event) {
    return (
      <div className="empty-state">
        <p>Event not found</p>
        <Button onClick={() => router.push("/event-history")} className="mt-4">Back to History</Button>
      </div>
    )
  }

  const statusColors: Record<string, 'success' | 'warning' | 'destructive'> = {
    active: "success",
    completed: "primary" as any,
    cancelled: "destructive"
  }

  return (
    <div className="max-w-5xl mx-auto print:max-w-none animate-in">
      {/* Header - Hide on print */}
      <div className="no-print">
        <Button variant="ghost" onClick={() => router.push("/event-history")} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to History
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Badge variant="primary" className="font-mono">{event.eventId}</Badge>
            <Badge variant={statusColors[event.status] || "warning"}>
              {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Select value={event.status} onValueChange={updateStatus} disabled={updating}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={openCopyDialog}><Copy className="w-4 h-4 mr-2" />Copy</Button>
            <Button variant="outline" onClick={exportCSV}><FileDown className="w-4 h-4 mr-2" />CSV</Button>
            <Button variant="outline" onClick={printEvent}><Printer className="w-4 h-4 mr-2" />Print</Button>
            <Button variant="destructive" onClick={deleteEvent}><Trash2 className="w-4 h-4 mr-2" />Delete</Button>
          </div>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block mb-2 border-b pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Anchal Caterers</h1>
            <p className="text-xs text-muted-foreground">Event Details</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-xs">{event.eventId}</p>
            <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Event Name */}
      <h1 className="text-3xl font-bold mb-6 print:text-xl print:mb-2">{event.organizerName}</h1>

      {/* Two Column Layout on desktop, Single Column for print */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1 print:gap-2">
        {/* Event Details */}
        <Card className="print:p-2">
          <h2 className="text-lg font-semibold mb-4 print:text-sm print:mb-1">Event Details / इवेंट विवरण</h2>
          <div className="space-y-4 print:space-y-0 print:text-xs print:grid print:grid-cols-3 print:gap-x-4 print:gap-y-1">
            <div className="flex items-start gap-3 print:gap-1">
              <Calendar className="w-5 h-5 print:w-3 print:h-3 text-muted-foreground mt-0.5 print:hidden" />
              <div>
                <p className="text-sm print:text-[10px] text-muted-foreground">Function Date</p>
                <p className="font-medium print:text-xs">{formatDate(event.functionDate)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 print:gap-1">
              <Clock className="w-5 h-5 print:w-3 print:h-3 text-muted-foreground mt-0.5 print:hidden" />
              <div>
                <p className="text-sm print:text-[10px] text-muted-foreground">Meal Type</p>
                <p className="font-medium print:text-xs capitalize">{event.functionTime}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 print:gap-1">
              <Users className="w-5 h-5 print:w-3 print:h-3 text-muted-foreground mt-0.5 print:hidden" />
              <div>
                <p className="text-sm print:text-[10px] text-muted-foreground">Guest Count</p>
                <p className="font-medium print:text-xs">{event.guestCount} Guests</p>
              </div>
            </div>
            <div className="flex items-start gap-3 print:gap-1">
              <Phone className="w-5 h-5 print:w-3 print:h-3 text-muted-foreground mt-0.5 print:hidden" />
              <div>
                <p className="text-sm print:text-[10px] text-muted-foreground">Phone Number</p>
                <p className="font-medium print:text-xs">{event.phoneNumber}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 print:gap-1">
              <MapPin className="w-5 h-5 print:w-3 print:h-3 text-muted-foreground mt-0.5 print:hidden" />
              <div>
                <p className="text-sm print:text-[10px] text-muted-foreground">Location</p>
                <p className="font-medium print:text-xs">{event.location}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 print:gap-1">
              <CalendarCheck className="w-5 h-5 print:w-3 print:h-3 text-muted-foreground mt-0.5 print:hidden" />
              <div>
                <p className="text-sm print:text-[10px] text-muted-foreground">Booking Date</p>
                <p className="font-medium print:text-xs">{formatDate(event.bookingDate)}</p>
              </div>
            </div>
            {event.menuCreationDate && (
              <div className="flex items-start gap-3 print:gap-1">
                <Calendar className="w-5 h-5 print:w-3 print:h-3 text-muted-foreground mt-0.5 print:hidden" />
                <div>
                  <p className="text-sm print:text-[10px] text-muted-foreground">Menu Creation Date</p>
                  <p className="font-medium print:text-xs">{formatDate(event.menuCreationDate)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Payment Info - Hide on Print */}
          {(event.totalAmount > 0 || event.advancePayment > 0) && (
            <div className="mt-4 pt-4 border-t no-print">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Payment Details / भुगतान
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="font-medium flex items-center">
                    <IndianRupee className="w-3 h-3" />
                    {(event.totalAmount || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Advance Paid</span>
                  <span className="font-medium text-green-600 flex items-center">
                    <IndianRupee className="w-3 h-3" />
                    {(event.advancePayment || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-medium">Remaining</span>
                  <span className="font-semibold text-amber-600 flex items-center">
                    <IndianRupee className="w-3 h-3" />
                    {((event.totalAmount || 0) - (event.advancePayment || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Menu Items */}
        <Card className="print:p-2">
          <h2 className="text-lg font-semibold mb-2 print:text-sm print:mb-1">Menu Items / मेन्यू आइटम</h2>
          <p className="text-sm text-muted-foreground mb-4 print:mb-1 print:text-xs">{event.eventItems?.length || 0} items</p>
          <div className="grid grid-cols-2 gap-2 print:grid-cols-4 print:gap-1">
            {event.eventItems?.map(ei => (
              <div key={ei.id} className="ingredient-card print:p-1 print:text-[10px]">
                <ChefHat className="w-4 h-4 text-primary shrink-0 print:w-2 print:h-2" />
                <span className="font-medium truncate">{ei.item?.name}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Ingredients List - Grouped by Category with Compact Grid */}
      {groupedIngredients.length > 0 && (
        <Card className="mt-6 print:mt-2 print:p-2">
          <div className="flex items-center gap-2 mb-4 print:mb-1">
            <Package className="w-5 h-5 text-secondary print:w-3 print:h-3" />
            <h2 className="text-lg font-semibold print:text-sm">Ingredients List / सामग्री सूची</h2>
            <Badge variant="success" className="print:text-[10px] print:px-1">{totalIngredients} items</Badge>
          </div>

          <div className="space-y-5 print:space-y-1">
            {groupedIngredients.map(group => (
              <div key={group.categoryId}>
                <div className="flex items-center gap-2 mb-3 print:mb-1">
                  <span className="font-semibold text-muted-foreground print:text-xs">→ {group.categoryName}</span>
                  <Badge variant="secondary" className="print:text-[10px] print:px-1">{group.ingredients.length}</Badge>
                </div>
                
                <div className="grid-4 print:grid-cols-5 print:gap-1">
                  {group.ingredients.map(ing => (
                    <div key={ing.id} className="ingredient-card print:p-1 print:text-[10px]">
                      <span className="font-medium truncate mr-1">{ing.name}</span>
                      <span className="text-primary font-semibold whitespace-nowrap">
                        {ing.quantity} {ing.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Notes */}
      {event.notes && (
        <Card className="mt-6 print:mt-2 print:p-2">
          <h2 className="text-lg font-semibold mb-2 print:text-sm print:mb-1">Notes / नोट्स</h2>
          <p className="text-muted-foreground print:text-xs">{event.notes}</p>
        </Card>
      )}

      {/* Print Footer */}
      <div className="hidden print:block mt-4 pt-2 border-t text-center text-xs text-muted-foreground">
        <p>Generated by Anchal Caterers Management System</p>
        <p>Printed on {new Date().toLocaleString()}</p>
      </div>

      {/* Copy Event Dialog */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5" />
              Copy Event / इवेंट कॉपी करें
            </DialogTitle>
          </DialogHeader>
          
          <p className="text-sm text-muted-foreground mb-4">
            Create a new event with the same menu items and ingredients.
            <br />
            <span className="text-xs">समान मेन्यू और सामग्री के साथ नया इवेंट बनाएं।</span>
          </p>

          <div className="space-y-4">
            <Input
              label="Organizer Name / आयोजक का नाम *"
              placeholder="Enter new organizer name"
              value={copyFormData.organizerName}
              onChange={e => setCopyFormData(prev => ({ ...prev, organizerName: e.target.value }))}
            />
            
            <Input
              label="Phone Number / फोन नंबर *"
              type="tel"
              placeholder="Enter phone number"
              value={copyFormData.phoneNumber}
              onChange={e => setCopyFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
            />
            
            <Input
              label="Location / स्थान"
              placeholder="Enter location"
              value={copyFormData.location}
              onChange={e => setCopyFormData(prev => ({ ...prev, location: e.target.value }))}
            />
            
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Function Date / तारीख *"
                type="date"
                value={copyFormData.functionDate}
                onChange={e => setCopyFormData(prev => ({ ...prev, functionDate: e.target.value }))}
              />
              
               <div>
              <label className="label mb-1.5 block">Meal Type / भोजन प्रकार *</label>
              <Select 
                  value={copyFormData.functionTime} 
                  onValueChange={v => setCopyFormData(prev => ({ ...prev, functionTime: v }))}
              >
             <SelectTrigger>
                 <SelectValue placeholder="Select meal type" />
             </SelectTrigger>
             <SelectContent>
                <SelectItem value="breakfast">Breakfast / नाश्ता</SelectItem>
                <SelectItem value="lunch">Lunch / दोपहर का भोजन</SelectItem>
                <SelectItem value="high-tea">High Tea / हाई टी</SelectItem>
                <SelectItem value="dinner">Dinner / रात का भोजन</SelectItem>
                <SelectItem value="brunch">Brunch / ब्रंच</SelectItem>
                <SelectItem value="snacks">Snacks / स्नैक्स</SelectItem>
                </SelectContent>
              </Select>
            </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Guest Count / मेहमान"
                type="number"
                value={copyFormData.guestCount}
                onChange={e => setCopyFormData(prev => ({ ...prev, guestCount: e.target.value }))}
              />
              
              <Input
                label="Per Plate Price (₹)"
                type="number"
                value={copyFormData.perPlatePrice}
                onChange={e => setCopyFormData(prev => ({ ...prev, perPlatePrice: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCopyEvent} loading={copying}>
              <Copy className="w-4 h-4 mr-2" />
              Create Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

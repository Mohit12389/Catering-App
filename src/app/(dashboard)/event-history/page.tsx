"use client"

import { useState } from "react"
import Link from "next/link"
import { 
  History, Calendar, Users, MapPin, ArrowRight,
  Search, CalendarPlus, UtensilsCrossed
} from "lucide-react"
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"
import { Card, Loading, EmptyState, Badge } from "@/components/shared"
import { useSWRFetch } from "@/hooks/useSWRFetch"
import { formatDate } from "@/lib/utils"

export default function EventHistoryPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const { data: events = [], isLoading } = useSWRFetch<any[]>('/api/events')

  const filteredEvents = events.filter(event => {
    const matchesSearch = 
      event.organizerName.toLowerCase().includes(search.toLowerCase()) ||
      event.eventId.toLowerCase().includes(search.toLowerCase()) ||
      event.location.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || event.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const statusColors: Record<string, 'success' | 'warning' | 'destructive'> = {
    active: "success",
    completed: "primary" as any,
    cancelled: "destructive"
  }

  if (isLoading) return <Loading text="Loading events..." />

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2">
            <History className="w-8 h-8 text-primary" />
            Event History / इवेंट इतिहास
          </h1>
          <p className="text-muted-foreground mt-1">View and manage all your events</p>
        </div>
        <div className="flex gap-3">
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <EmptyState icon={History} title="No events found"
          description={search || statusFilter !== "all" ? "Try different filters" : "Create an event to get started"}
          action={<Link href="/create-event" className="btn-primary">Create Event</Link>}
        />
      ) : (
        <div className="grid-3">
          {filteredEvents.map(event => {
            const mealLabels = event.mealLabels || []
            const totalItems = event.eventItems?.length || 0
            const isFullyPaid = event.totalAmount > 0 && event.advancePayment >= event.totalAmount

            return (
              <Link key={event.id} href={`/event-history/${event.id}`}>
                <Card hover className="h-full">
                  <div className="flex items-start justify-between mb-3">
                    <span className="badge-primary font-mono text-xs">{event.eventId}</span>
                    <div className="flex items-center gap-1.5">
                      {isFullyPaid && (
                        <Badge variant="success" className="text-xs font-semibold">Fully Paid ✓</Badge>
                      )}
                      {mealLabels.length > 1 && (
                        <Badge variant="secondary" className="text-xs">{mealLabels.length} meals</Badge>
                      )}
                      <Badge variant={statusColors[event.status] || "warning"}>
                        {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                  
                  <h3 className="font-semibold text-lg mb-3">{event.organizerName}</h3>
                  
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span>Event Date: {formatDate(event.functionDate)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>{event.guestCount} Guests</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">{event.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarPlus className="w-4 h-4 text-secondary" />
                      <span>Menu Creation Date: {event.menuCreationDate ? formatDate(event.menuCreationDate) : "Not set"}</span>
                    </div>
                  </div>

                  {/* Meal label badges */}
                  {mealLabels.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {mealLabels.map((meal: any, idx: number) => (
                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full capitalize">
                          <UtensilsCrossed className="w-3 h-3" />
                          {meal.label}
                          {meal.date && mealLabels.length > 1 && (
                            <span className="text-muted-foreground">{formatDate(meal.date).slice(0, 6)}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div className="mt-4 pt-4 border-t flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{totalItems} items</span>
                    <ArrowRight className="w-4 h-4 text-primary" />
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
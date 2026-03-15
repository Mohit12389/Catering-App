"use client"

import Link from "next/link"
import { 
  UtensilsCrossed, 
  Calendar, 
  Users, 
  MapPin,
  ArrowRight,
  Search
} from "lucide-react"
import { useState } from "react"
import { Input } from "@/components/ui"
import { Card, Loading, EmptyState, Badge } from "@/components/shared"
import { useSWRFetch } from "@/hooks/useSWRFetch"
import type { Event } from "@/types"
import { formatDate } from "@/lib/utils"

export default function EventMenuPage() {
  const [search, setSearch] = useState("")
  
  const { data: events = [], isLoading } = useSWRFetch<any[]>('/api/events?status=active')

  const filteredEvents = events.filter(event => 
    event.organizerName.toLowerCase().includes(search.toLowerCase()) ||
    event.eventId.toLowerCase().includes(search.toLowerCase()) ||
    event.location.toLowerCase().includes(search.toLowerCase())
  )

  const hasIngredientsSet = (event: any) => {
    return event.eventIngredients?.some((ei: any) => ei.quantity > 0)
  }

  if (isLoading) return <Loading text="Loading events..." />

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2">
            <UtensilsCrossed className="w-8 h-8 text-primary" />
            Event Menu / इवेंट मेन्यू
          </h1>
          <p className="text-muted-foreground mt-1">
            Set ingredient quantities for your events
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No active events"
          description="Create an event to get started"
          action={
            <Link href="/create-event" className="btn-primary">
              Create Event
            </Link>
          }
        />
      ) : (
        <div className="grid-3">
          {filteredEvents.map(event => {
            const subEvents = event.subEvents || []
            const hasSubEvents = subEvents.length > 0
            const totalItems = (event.eventItems?.length || 0) + 
              subEvents.reduce((sum: number, se: any) => sum + (se._count?.eventItems || 0), 0)
            const allMeals = [
              { functionTime: event.functionTime, functionDate: event.functionDate, guestCount: event.guestCount },
              ...subEvents.map((se: any) => ({ functionTime: se.functionTime, functionDate: se.functionDate, guestCount: se.guestCount }))
            ]

            return (
              <Link key={event.id} href={`/event-menu/${event.id}`}>
                <Card hover className="h-full">
                  <div className="flex items-start justify-between mb-3">
                    <span className="badge-primary font-mono text-xs">{event.eventId}</span>
                    <div className="flex items-center gap-1.5">
                      {hasSubEvents && (
                        <Badge variant="secondary" className="text-xs">
                          {allMeals.length} meals
                        </Badge>
                      )}
                      <Badge variant={hasIngredientsSet(event) ? "success" : "warning"}>
                        {hasIngredientsSet(event) ? "Ready" : "Pending"}
                      </Badge>
                    </div>
                  </div>
                  
                  <h3 className="font-semibold text-lg mb-3">{event.organizerName}</h3>
                  
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(event.functionDate)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>{event.guestCount} Guests</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">{event.location}</span>
                    </div>
                  </div>

                  {/* Meal badges — shows all meals (parent + sub-events) */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {allMeals.map((meal: any, idx: number) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full capitalize"
                      >
                        <UtensilsCrossed className="w-3 h-3" />
                        {meal.functionTime}
                        {hasSubEvents && (
                          <span className="text-muted-foreground">
                            {formatDate(meal.functionDate).slice(0, 6)}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {totalItems} items
                    </span>
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
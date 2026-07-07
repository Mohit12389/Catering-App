"use client"

import Link from "next/link"
import { UtensilsCrossed, Calendar, Users, MapPin, Home, Search, Phone } from "lucide-react"
import { useState } from "react"
import { Input } from "@/components/ui"
import { Card, Loading, EmptyState, Badge } from "@/components/shared"
import { useSWRFetch } from "@/hooks/useSWRFetch"
import { formatDate } from "@/lib/utils"

export default function EventMenuPage() {
  const [search, setSearch] = useState("")
  const { data: events = [], isLoading } = useSWRFetch<any[]>('/api/events?status=active')

  const filteredEvents = events.filter(event => 
    event.organizerName.toLowerCase().includes(search.toLowerCase()) ||
    event.eventId.toLowerCase().includes(search.toLowerCase()) ||
    event.location.toLowerCase().includes(search.toLowerCase()) ||
    event.phoneNumber?.toLowerCase().includes(search.toLowerCase())
  )

  const hasIngredientsSet = (event: any) => event.eventIngredients?.some((ei: any) => ei.quantity > 0)

  if (isLoading) return <Loading text="Loading events..." />

  return (
    <div className="space-y-6 animate-in">
      {/* ========== Header ========== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2">
            <UtensilsCrossed className="w-8 h-8 text-primary" />
            Event Menu / इवेंट मेन्यू
          </h1>
          <p className="text-muted-foreground mt-1">Set ingredient quantities for your events</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {/* ========== Table ========== */}
      {filteredEvents.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} title="No active events" description="Create an event to get started"
          action={<Link href="/create-event" className="btn-primary">Create Event</Link>}
        />
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs text-muted-foreground uppercase border-b">
                <th className="p-3 whitespace-nowrap">Status</th>
                <th className="p-3 whitespace-nowrap">Organizer</th>
                <th className="p-3 whitespace-nowrap">Phone</th>
                <th className="p-3 whitespace-nowrap">Home Address</th>
                <th className="p-3 whitespace-nowrap">Venue Location</th>
                <th className="p-3 whitespace-nowrap">Event Date</th>
                <th className="p-3 whitespace-nowrap">Meals / Sub-Events</th>
                <th className="p-3 whitespace-nowrap text-center">Items</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map(event => {
                const mealLabels = event.mealLabels || []
                const totalItems = event.eventItems?.length || 0
                const isReady = hasIngredientsSet(event)

                return (
                  <tr
                    key={event.id}
                    className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/event-menu/${event.id}`}
                  >
                    {/* Status */}
                    <td className="p-3">
                      <Badge variant={isReady ? "success" : "warning"} className="text-xs">
                        {isReady ? "Ready" : "Pending"}
                      </Badge>
                    </td>

                    {/* Organizer Name */}
                    <td className="p-3">
                      <div>
                        <p className="font-semibold">{event.organizerName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{event.eventId}</p>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="p-3 whitespace-nowrap text-muted-foreground">
                      {event.phoneNumber}
                    </td>

                    {/* Home Address */}
                    <td className="p-3 text-muted-foreground max-w-[150px]">
                      <span className="truncate block" title={event.homeAddress || ""}>
                        {event.homeAddress || "—"}
                      </span>
                    </td>

                    {/* Venue Location */}
                    <td className="p-3 text-muted-foreground max-w-[150px]">
                      <span className="truncate block" title={event.location}>
                        {event.location}
                      </span>
                    </td>

                    {/* Event Date */}
                    <td className="p-3 whitespace-nowrap">
                      {formatDate(event.functionDate)}
                    </td>

                    {/* Meals / Sub-Events */}
                    <td className="p-3">
                      {mealLabels.length > 0 ? (
                        <div className="space-y-0.5">
                          {mealLabels.map((meal: any, idx: number) => (
                            <div key={idx} className="text-xs capitalize">
                              <span className="font-medium">{meal.label}</span>
                              {meal.date && (
                                <span className="text-muted-foreground ml-1">
                                  {formatDate(meal.date).slice(0, 6)}
                                </span>
                              )}
                              {meal.guests > 0 && (
                                <span className="text-muted-foreground ml-1">
                                  ({meal.guests}g)
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">{event.guestCount} guests</span>
                      )}
                    </td>

                    {/* Total Items */}
                    <td className="p-3 text-center font-semibold">
                      {totalItems}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
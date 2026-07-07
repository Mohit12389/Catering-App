"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { 
  History, Calendar, Users, MapPin, Home, ArrowRight,
  Search, UtensilsCrossed, Phone, Printer, IndianRupee
} from "lucide-react"
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Button } from "@/components/ui"
import { Card, Loading, EmptyState, Badge } from "@/components/shared"
import { useSWRFetch } from "@/hooks/useSWRFetch"
import { formatDate } from "@/lib/utils"

export default function EventHistoryPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Date range for print filter
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // Fetch user role to hide advance column for staff
  const [userRole, setUserRole] = useState<string>("owner")
  useEffect(() => {
    const fetchRole = async () => {
      try {
        const res = await fetch("/api/user/organization")
        const data = await res.json()
        if (data.success) setUserRole(data.data.role || "owner")
      } catch {}
    }
    fetchRole()
  }, [])

  const { data: events = [], isLoading } = useSWRFetch<any[]>('/api/events')

  // Filter events by search, status, and date range
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // Search filter
      const matchesSearch = 
        event.organizerName.toLowerCase().includes(search.toLowerCase()) ||
        event.eventId.toLowerCase().includes(search.toLowerCase()) ||
        event.location.toLowerCase().includes(search.toLowerCase()) ||
        event.phoneNumber?.toLowerCase().includes(search.toLowerCase())

      // Status filter
      const matchesStatus = statusFilter === "all" || event.status === statusFilter

      // Date range filter
      let matchesDate = true
      if (startDate) {
        matchesDate = matchesDate && new Date(event.functionDate) >= new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        matchesDate = matchesDate && new Date(event.functionDate) <= end
      }

      return matchesSearch && matchesStatus && matchesDate
    })
  }, [events, search, statusFilter, startDate, endDate])

  const statusColors: Record<string, 'success' | 'warning' | 'destructive'> = {
    active: "success",
    completed: "primary" as any,
    cancelled: "destructive"
  }

  // Print handler
  const handlePrint = () => window.print()

  if (isLoading) return <Loading text="Loading events..." />

  return (
    <>
      {/* Print styles — hide filters, show only table */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-table { font-size: 11px !important; }
          .print-table th, .print-table td { padding: 3px 6px !important; }
        }
      `}</style>

      <div className="space-y-6 animate-in">
        {/* ========== Header + Filters ========== */}
        <div className="no-print">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="flex items-center gap-2">
                <History className="w-8 h-8 text-primary" />
                Event History / इवेंट इतिहास
              </h1>
              <p className="text-muted-foreground mt-1">View and manage all your events</p>
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-end gap-3">
            {/* Search */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Range */}
            <div className="flex items-end gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">From</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">To</label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36" />
              </div>
              {(startDate || endDate) && (
                <Button variant="ghost" size="sm" onClick={() => { setStartDate(""); setEndDate("") }}>
                  Clear
                </Button>
              )}
            </div>

            {/* Print Button */}
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1" />Print
            </Button>
          </div>
        </div>

        {/* Print Header */}
        <div className="hidden print:block text-center mb-2">
          <h1 className="text-lg font-bold">Anchal Caterers — Event History</h1>
          {(startDate || endDate) && (
            <p className="text-xs text-muted-foreground">
              {startDate ? formatDate(startDate) : "..."} — {endDate ? formatDate(endDate) : "..."}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{filteredEvents.length} events</p>
        </div>

        {/* ========== Table ========== */}
        {filteredEvents.length === 0 ? (
          <EmptyState icon={History} title="No events found"
            description={search || statusFilter !== "all" || startDate || endDate ? "Try different filters" : "Create an event to get started"}
            action={<Link href="/create-event" className="btn-primary">Create Event</Link>}
          />
        ) : (
          <div className="border rounded-lg overflow-x-auto print:border-none">
            <table className="w-full text-sm print-table">
              <thead>
                <tr className="bg-muted/50 text-left text-xs text-muted-foreground uppercase border-b">
                  <th className="p-3 whitespace-nowrap">Organizer</th>
                  <th className="p-3 whitespace-nowrap">Phone</th>
                  <th className="p-3 whitespace-nowrap">Home Address</th>
                  <th className="p-3 whitespace-nowrap">Venue Location</th>
                  <th className="p-3 whitespace-nowrap">Meals / Sub-Events</th>
                  <th className="p-3 whitespace-nowrap text-center">Items</th>
                  <th className="p-3 whitespace-nowrap">Menu Created</th>
                  <th className="p-3 whitespace-nowrap">Status</th>
                  <th className="p-3 whitespace-nowrap">Payment</th>
                  {/* CHANGED: Advance column hidden for staff */}
                  {userRole !== "staff" && (
                    <th className="p-3 whitespace-nowrap">Advance</th>
                  )}
                  <th className="p-3 whitespace-nowrap no-print"></th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map(event => {
                  const mealLabels = event.mealLabels || []
                  const totalItems = event.eventItems?.length || 0
                  const isFullyPaid = event.totalAmount > 0 && event.advancePayment >= event.totalAmount
                  const remaining = Math.max(0, (event.totalAmount || 0) - (event.advancePayment || 0))

                  return (
                    <tr
                      key={event.id}
                      className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => window.location.href = `/event-history/${event.id}`}
                    >
                      {/* Organizer */}
                      <td className="p-3">
                        <div>
                          <p className="font-semibold">{event.organizerName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{event.eventId}</p>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="p-3 whitespace-nowrap text-muted-foreground text-xs">
                        {event.phoneNumber}
                      </td>

                      {/* Home Address */}
                      <td className="p-3 text-muted-foreground max-w-[120px]">
                        <span className="truncate block text-xs" title={event.homeAddress || ""}>
                          {event.homeAddress || "—"}
                        </span>
                      </td>

                      {/* Venue Location */}
                      <td className="p-3 text-muted-foreground max-w-[120px]">
                        <span className="truncate block text-xs" title={event.location}>
                          {event.location}
                        </span>
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
                                <span className="text-muted-foreground ml-1">
                                  ({meal.guests || 0}g)
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">{event.guestCount} guests</span>
                        )}
                      </td>

                      {/* Total Items */}
                      <td className="p-3 text-center font-semibold text-xs">
                        {totalItems}
                      </td>

                      {/* Menu Creation Date */}
                      <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">
                        {event.menuCreationDate ? formatDate(event.menuCreationDate) : "—"}
                      </td>

                      {/* Status */}
                      <td className="p-3">
                        <Badge variant={statusColors[event.status] || "warning"} className="text-xs">
                          {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                        </Badge>
                      </td>

                      {/* Payment Status */}
                      <td className="p-3">
                        {event.totalAmount > 0 ? (
                          isFullyPaid ? (
                            <Badge variant="success" className="text-xs">Paid ✓</Badge>
                          ) : event.advancePayment > 0 ? (
                            <Badge variant="warning" className="text-xs">Partial</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">Unpaid</Badge>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Advance (hidden for staff) */}
                      {userRole !== "staff" && (
                        <td className="p-3 whitespace-nowrap text-xs">
                          {event.totalAmount > 0 ? (
                            <div>
                              <p className="font-semibold text-green-600 flex items-center">
                                <IndianRupee className="w-3 h-3" />
                                {(event.advancePayment || 0).toLocaleString()}
                              </p>
                              {remaining > 0 && (
                                <p className="text-amber-600 flex items-center">
                                  <span className="text-muted-foreground mr-0.5">rem:</span>
                                  <IndianRupee className="w-3 h-3" />
                                  {remaining.toLocaleString()}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      )}

                      {/* Arrow (screen only) */}
                      <td className="p-3 no-print">
                        <ArrowRight className="w-4 h-4 text-primary" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
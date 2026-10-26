"use client"

// =============================================
// EXTRA EXPENSES (revenue page, below Category Details)
// =============================================
// CHANGED: new. Event expenses (transport, layout, waiters) for the procurement date
// range: totals by name, then one row per event. Display only — they are edited on
// the Event Menu page, which the event name links to.

import Link from "next/link"
import { Truck } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/shared"
import { formatDate } from "@/lib/utils"
import type { ExtraExpenses } from "./types"

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`

export function ExtraExpensesCard({ data }: { data: ExtraExpenses }) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Extra Expenses / अतिरिक्त खर्च
          </CardTitle>
          <span className="text-lg font-bold text-orange-600">{rupees(data.total)}</span>
        </div>
      </CardHeader>
      <CardContent>
        {data.events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No expenses in this date range. Add them on an event&apos;s Menu page.
          </p>
        ) : (
          <>
            {/* Totals by type — what went on waiters, transport… in this range */}
            <div className="flex flex-wrap gap-2 mb-4">
              {data.byName.map(n => (
                <span key={n.name} className="px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-sm">
                  {n.name} <span className="font-semibold text-orange-700">{rupees(n.total)}</span>
                </span>
              ))}
            </div>

            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
                    <th className="p-3">Date</th>
                    <th className="p-3">Event</th>
                    <th className="p-3">Venue</th>
                    <th className="p-3">Expenses</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map(ev => (
                    <tr key={ev.eventDbId} className="border-t align-top hover:bg-muted/20">
                      <td className="p-3 whitespace-nowrap">{formatDate(ev.functionDate)}</td>
                      <td className="p-3">
                        <span className="font-mono text-xs text-muted-foreground">{ev.eventId}</span>
                        <p><Link href={`/event-menu/${ev.eventDbId}`} className="font-medium hover:underline">{ev.organizerName}</Link></p>
                      </td>
                      <td className="p-3 text-muted-foreground">{ev.location}</td>
                      <td className="p-3">
                        <div className="space-y-0.5">
                          {ev.items.map((x, i) => (
                            <div key={i}>
                              <span className="font-medium">{x.name}</span>
                              <span className="text-muted-foreground"> {x.quantity} × ₹{x.rate.toLocaleString("en-IN")} = </span>
                              <span className="font-medium">{rupees(x.amount)}</span>
                              {x.notes && <span className="text-xs text-amber-700"> ({x.notes})</span>}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-right font-semibold text-orange-600 whitespace-nowrap">{rupees(ev.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 font-bold border-t-2">
                    <td className="p-3" colSpan={4}>Total / कुल ({data.events.length} events)</td>
                    <td className="p-3 text-right text-orange-600">{rupees(data.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

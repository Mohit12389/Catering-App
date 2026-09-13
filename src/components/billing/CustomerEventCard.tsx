"use client"

import { Banknote, Package, TrendingUp, User, Users } from "lucide-react"
import { Badge } from "@/components/shared"
import { formatDate, cn } from "@/lib/utils"

// =============================================
// ONE OF THE CUSTOMER'S EVENTS, ON THE BILL FORM
// =============================================
// CHANGED: lifted out of billing/page.tsx, where it was ~60 lines inside a .map().
// Shows what the client is charged against what the food actually cost, so the owner
// can see the margin before billing — which is the whole point of the panel.
//
// Profit is client amount minus CATERER cost only. Ingredients the client bought
// themselves are shown separately and deliberately excluded: the caterer never paid
// for them, so counting them would understate the margin.

export interface BillableEventMeal {
  label: string
  guests: number
  perPlate: number
}

export interface BillableEvent {
  id: string
  functionDate: string | Date
  functionTime?: string | null
  organizerName: string
  status: string
  totalAmount: number
  guestCount?: number | null
  perPlatePrice?: number | null
  catererCost?: number | null
  clientCost?: number | null
  advancePayment?: number | null
  advancePayments?: unknown[]
  mealGroups?: BillableEventMeal[]
}

interface CustomerEventCardProps {
  event: BillableEvent
  selected: boolean
  onSelect: () => void
}

export function CustomerEventCard({ event, selected, onSelect }: CustomerEventCardProps) {
  const catererCost = event.catererCost || 0
  const clientCost = event.clientCost || 0
  const profit = event.totalAmount - catererCost
  const profitPercent = event.totalAmount > 0 ? ((profit / event.totalAmount) * 100).toFixed(1) : "0"
  const advanceTotal = event.advancePayment || 0
  const installmentCount = event.advancePayments?.length || 0
  const meals = event.mealGroups || []

  return (
    <div
      className={cn(
        "p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors",
        selected && "border-primary bg-primary/5"
      )}
      onClick={onSelect}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-semibold">{formatDate(event.functionDate)}</p>
          <p className="text-xs text-muted-foreground capitalize">{event.functionTime}</p>
        </div>
        <Badge variant={event.status === "completed" ? "success" : "warning"}>{event.status}</Badge>
      </div>

      <div className="flex items-center gap-1 text-sm mb-2">
        <User className="w-3 h-3 text-muted-foreground" />
        <span className="font-medium">{event.organizerName}</span>
      </div>

      {/* Per-meal breakdown: one booking can be several meals at different prices. */}
      <div className="text-sm text-muted-foreground mb-2 space-y-0.5">
        {meals.length > 0 ? (
          meals.map((meal, idx) => (
            <p key={idx} className="capitalize">
              {meal.label}: {meal.guests}g × ₹{meal.perPlate.toLocaleString("en-IN")}
            </p>
          ))
        ) : (
          <p>{event.guestCount} guests × ₹{event.perPlatePrice}</p>
        )}
      </div>

      <div className="bg-muted/50 rounded p-2 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Client Amount:</span>
          <span className="font-semibold text-primary">₹{event.totalAmount.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground flex items-center gap-1"><Package className="w-3 h-3" />Caterer Cost:</span>
          <span className="font-medium text-amber-600">₹{catererCost.toLocaleString("en-IN")}</span>
        </div>
        {clientCost > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" />Client Cost:</span>
            <span className="font-medium text-blue-600">₹{clientCost.toLocaleString("en-IN")}</span>
          </div>
        )}
        {advanceTotal > 0 && (
          <div className="flex justify-between pt-1 border-t border-muted">
            <span className="text-muted-foreground flex items-center gap-1">
              <Banknote className="w-3 h-3" />Advance ({installmentCount}):
            </span>
            <span className="font-semibold text-green-600">₹{advanceTotal.toLocaleString("en-IN")}</span>
          </div>
        )}
        <div className="flex justify-between pt-1.5 border-t border-muted">
          <span className="text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" />Profit:</span>
          <span className={cn("font-semibold", profit >= 0 ? "text-green-600" : "text-red-600")}>
            ₹{profit.toLocaleString("en-IN")} ({profitPercent}%)
          </span>
        </div>
      </div>

      <p className="text-xs text-primary mt-2">{selected ? "✓ Added to bill" : "Click to add to bill"}</p>
    </div>
  )
}

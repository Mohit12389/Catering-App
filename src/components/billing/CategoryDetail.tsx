"use client"

import { useState } from "react"
import {
  Calendar, Check, CheckCircle, ChevronDown, ChevronUp,
  Loader2, MapPin, Package, Undo2, Users, X
} from "lucide-react"
import { Button } from "@/components/ui"
import { Badge } from "@/components/shared"
import { formatDate, cn } from "@/lib/utils"
import { IngredientRow } from "./IngredientRow"
import type { ProcurementCategory } from "./types"

// CHANGED: lifted verbatim out of billing/stats/page.tsx — the largest block in that
// file. Shows one ingredient category's cost, its ingredients, and the per-event
// mark-as-paid controls.

export function CategoryDetail({ 
  category,
  onMarkPaid,
  onUnmarkPaid,
  markingPayment 
}: { 
  category: ProcurementCategory
  onMarkPaid: (eventDbIds: string[], categoryId: string, categoryName: string) => void
  onUnmarkPaid: (eventDbId: string, categoryId: string) => void
  markingPayment: boolean
}) {
  const [showIngredients, setShowIngredients] = useState(false)
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([])

  const unpaidEvents = category.events.filter(e => !e.isPaid)
  const paidEvents = category.events.filter(e => e.isPaid)
  const totalPaidAmount = paidEvents.reduce((sum, e) => sum + e.categoryCost, 0)
  const totalUnpaidAmount = unpaidEvents.reduce((sum, e) => sum + e.categoryCost, 0)

  const toggleEventSelection = (eventDbId: string) => {
    setSelectedEventIds(prev => 
      prev.includes(eventDbId) 
        ? prev.filter(id => id !== eventDbId)
        : [...prev, eventDbId]
    )
  }

  const selectAllUnpaid = () => {
    setSelectedEventIds(unpaidEvents.map(e => e.eventDbId))
  }

  const clearSelection = () => {
    setSelectedEventIds([])
  }

  const handleMarkPaid = () => {
    if (selectedEventIds.length === 0) return
    onMarkPaid(selectedEventIds, category.categoryId, category.categoryName)
    setSelectedEventIds([])
  }

  return (
    <div className="space-y-4">
      {/* Category Summary Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-muted/50 rounded-lg">
        <div>
          <h3 className="text-lg font-bold">{category.categoryName}</h3>
          <p className="text-sm text-muted-foreground">
            {category.ingredients.length} ingredients across {category.events.length} events
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-center">
            <p className="text-muted-foreground">Total Cost</p>
            <p className="text-lg font-bold text-primary">₹{category.totalCost.toLocaleString("en-IN")}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">Paid</p>
            <p className="text-lg font-bold text-green-600">₹{totalPaidAmount.toLocaleString("en-IN")}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">Unpaid</p>
            <p className="text-lg font-bold text-red-600">₹{totalUnpaidAmount.toLocaleString("en-IN")}</p>
          </div>
        </div>
      </div>

      {/* Events List for this Category */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Events / इवेंट्स
          </h4>
          {unpaidEvents.length > 0 && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={selectAllUnpaid}>
                Select All Unpaid
              </Button>
              {selectedEventIds.length > 0 && (
                <>
                  <Button size="sm" variant="outline" onClick={clearSelection}>
                    <X className="w-3 h-3 mr-1" />Clear
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleMarkPaid}
                    disabled={markingPayment}
                  >
                    {markingPayment ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3 mr-1" />
                    )}
                    Mark {selectedEventIds.length} as Paid
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          {category.events.map((event) => (
            <div
              key={event.eventDbId}
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border transition-all",
                event.isPaid 
                  ? "bg-green-50/50 border-green-200" 
                  : selectedEventIds.includes(event.eventDbId)
                    ? "bg-primary/5 border-primary"
                    : "hover:bg-muted/30"
              )}
            >
              <div className="flex items-center gap-3">
                {!event.isPaid && (
                  <input
                    type="checkbox"
                    checked={selectedEventIds.includes(event.eventDbId)}
                    onChange={() => toggleEventSelection(event.eventDbId)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{event.eventId}</span>
                    <Badge variant={event.boughtBy === "caterer" ? "warning" : "secondary"}>
                      {event.boughtBy === "caterer" ? "Caterer Bought" : "Client Bought"}
                    </Badge>
                    {event.isPaid && (
                      <Badge variant="success">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Paid {event.paymentDate ? formatDate(event.paymentDate) : ""}
                      </Badge>
                    )}
                  </div>
                  <p className="font-medium mt-0.5">{event.organizerName}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(event.functionDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {event.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {event.guestCount} guests
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-lg font-bold">₹{event.categoryCost.toLocaleString("en-IN")}</p>
                  <p className="text-xs text-muted-foreground">Category cost</p>
                </div>
                {event.isPaid && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => onUnmarkPaid(event.eventDbId, category.categoryId)}
                    disabled={markingPayment}
                  >
                    <Undo2 className="w-3 h-3 mr-1" />
                    Undo
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Aggregated Ingredients List */}
      <div>
        <button
          onClick={() => setShowIngredients(!showIngredients)}
          className="flex items-center gap-2 font-semibold text-sm hover:text-primary transition-colors w-full py-2"
        >
          <Package className="w-4 h-4" />
          Total Ingredients Summary / कुल सामग्री सारांश
          ({category.ingredients.length} items)
          {showIngredients ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
        </button>

        {showIngredients && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
                  <th className="p-3">Ingredient / सामग्री</th>
                  <th className="p-3 text-center">Total Qty</th>
                  <th className="p-3 text-center">Unit</th>
                  <th className="p-3 text-right">Total Cost</th>
                  <th className="p-3 text-center">Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {category.ingredients.map((ing) => (
                  <IngredientRow key={ing.ingredientId} ingredient={ing} />
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 font-bold">
                  <td className="p-3">Total</td>
                  <td className="p-3"></td>
                  <td className="p-3"></td>
                  <td className="p-3 text-right text-primary">₹{category.totalCost.toLocaleString("en-IN")}</td>
                  <td className="p-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================
// INGREDIENT ROW WITH EXPANDABLE BREAKDOWN

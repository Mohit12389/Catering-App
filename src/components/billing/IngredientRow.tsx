"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { formatDate } from "@/lib/utils"
import type { ProcurementIngredient } from "./types"

// CHANGED: lifted verbatim out of billing/stats/page.tsx. One ingredient row in the
// procurement table, expandable to show its per-event breakdown.

export function IngredientRow({ ingredient }: { ingredient: ProcurementIngredient }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr className="border-t hover:bg-muted/20 transition-colors">
        <td className="p-3 font-medium">{ingredient.name}</td>
        <td className="p-3 text-center font-semibold">{ingredient.totalQuantity}</td>
        <td className="p-3 text-center text-muted-foreground">{ingredient.unit}</td>
        <td className="p-3 text-right font-semibold">₹{ingredient.totalCost.toLocaleString("en-IN")}</td>
        <td className="p-3 text-center">
          {ingredient.perEvent.length > 1 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-primary hover:underline flex items-center gap-1 mx-auto"
            >
              {ingredient.perEvent.length} events
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
          {ingredient.perEvent.length === 1 && (
            <span className="text-xs text-muted-foreground">1 event</span>
          )}
        </td>
      </tr>
      {expanded && ingredient.perEvent.map((pe, idx) => (
        <tr key={idx} className="bg-muted/10 text-xs">
          <td className="pl-8 py-2">
            <span className="text-muted-foreground">↳</span> {pe.organizerName}
            <span className="text-muted-foreground ml-1">({formatDate(pe.functionDate)})</span>
          </td>
          <td className="py-2 text-center">{pe.quantity}</td>
          <td className="py-2 text-center text-muted-foreground">{ingredient.unit}</td>
          <td className="py-2 text-right">
            ₹{pe.cost.toLocaleString("en-IN")}
            <span className="text-muted-foreground ml-1">
              (@₹{pe.pricePerUnit}/{ingredient.unit})
            </span>
          </td>
          <td className="py-2 text-center">
            <span className="font-mono text-muted-foreground">{pe.eventId}</span>
          </td>
        </tr>
      ))}
    </>
  )
}

// =============================================
// MAIN PAGE COMPONENT

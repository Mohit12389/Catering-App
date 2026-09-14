"use client"

import { FileText, Plus, Trash2 } from "lucide-react"
import { Button, Input } from "@/components/ui"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/shared"
import type { BillLineItem } from "./types"

// =============================================
// THE LINE ITEMS OF A BILL
// =============================================
// CHANGED: lifted out of billing/new/page.tsx. Controlled, matching how CopyEventDialog
// and CustomerEventCard are built — the page still owns the items array, because it is
// the page that seeds it from the selected events (one row per MEAL) and submits it.
// This component renders the rows and reports edits.
//
// Why one row per meal rather than one per event: each meal has its own guest count and
// per-plate price, and the customer needs to see them separately on the invoice.

interface BillItemsTableProps {
  items: BillLineItem[]
  onChange: (index: number, field: keyof BillLineItem, value: string | number) => void
  onAdd: () => void
  onRemove: (index: number) => void
}

export function BillItemsTable({ items, onChange, onAdd, onRemove }: BillItemsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2"><FileText className="w-5 h-5" />Bill Items</span>
          <Button size="sm" onClick={onAdd}><Plus className="w-4 h-4 mr-1" />Add Row</Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="pb-2 w-8">S.No</th>
                <th className="pb-2">Description</th>
                <th className="pb-2 w-20">Qty</th>
                <th className="pb-2 w-28">Rate (₹)</th>
                <th className="pb-2 w-28">Amount</th>
                <th className="pb-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b">
                  <td className="py-2 text-sm text-muted-foreground">{idx + 1}</td>
                  <td className="py-2">
                    <Input
                      placeholder="Event description"
                      value={item.description}
                      onChange={e => onChange(idx, "description", e.target.value)}
                      className="h-9"
                    />
                  </td>
                  <td className="py-2">
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={e => onChange(idx, "quantity", parseFloat(e.target.value) || 0)}
                      className="h-9"
                    />
                  </td>
                  <td className="py-2">
                    <Input
                      type="number"
                      value={item.rate}
                      onChange={e => onChange(idx, "rate", parseFloat(e.target.value) || 0)}
                      className="h-9"
                    />
                  </td>
                  <td className="py-2 font-medium">
                    ₹{(item.quantity * item.rate).toLocaleString("en-IN")}
                  </td>
                  <td className="py-2">
                    {/* The last row cannot be removed — a bill with no items is not a bill,
                        and the API rejects one anyway. */}
                    {items.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => onRemove(idx)} className="h-8 w-8 text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

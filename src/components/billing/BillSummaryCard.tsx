"use client"

import { useMemo } from "react"
import { IndianRupee, Banknote, Receipt, X } from "lucide-react"
import { Button } from "@/components/ui"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/shared"
import { billTotals } from "@/lib/billTotals"
import { cn } from "@/lib/utils"
import type { BillLineItem } from "./types"

// =============================================
// WHAT THE CUSTOMER WILL BE CHARGED
// =============================================
// CHANGED: lifted out of billing/new/page.tsx, which computed subtotal, discount, tax and
// total inline in the page body — a fourth copy of arithmetic that also lives in the two
// bill API routes. It now calls the same billTotals() those routes call, so the figure
// the operator approves and the figure the server stores agree by construction.
//
// The advance line matters to the operator: he wants to see the balance the customer
// still has to hand over, not just the invoice total.

interface BillSummaryCardProps {
  items: BillLineItem[]
  discountType: string
  discountValue: string
  sgst: string
  cgst: string
  /** Already paid against the selected events, before this bill exists. */
  advancePaid: number
  isEditing: boolean
  saving?: boolean
  onSave: () => void
  onCancel: () => void
}

export function BillSummaryCard({
  items, discountType, discountValue, sgst, cgst,
  advancePaid, isEditing, saving, onSave, onCancel
}: BillSummaryCardProps) {
  const totals = useMemo(
    () => billTotals({ items, discountType, discountValue, sgst, cgst }),
    [items, discountType, discountValue, sgst, cgst]
  )

  const balanceDue = Math.max(0, totals.totalAmount - advancePaid)
  const settled = totals.totalAmount - advancePaid <= 0

  const money = (n: number) => n.toLocaleString("en-IN")

  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><IndianRupee className="w-5 h-5" />Bill Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>₹{money(totals.subtotal)}</span>
          </div>

          {totals.discountAmount > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Discount</span>
              <span>-₹{money(totals.discountAmount)}</span>
            </div>
          )}

          {totals.sgstAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">SGST ({sgst}%)</span>
              <span>₹{money(totals.sgstAmount)}</span>
            </div>
          )}

          {totals.cgstAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">CGST ({cgst}%)</span>
              <span>₹{money(totals.cgstAmount)}</span>
            </div>
          )}

          <div className="border-t pt-3">
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-primary">₹{money(totals.totalAmount)}</span>
            </div>
          </div>

          {advancePaid > 0 && (
            <>
              <div className="flex justify-between text-green-600">
                <span className="flex items-center gap-1"><Banknote className="w-3 h-3" />Advance Paid</span>
                <span>-₹{money(advancePaid)}</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between text-lg font-bold">
                  <span>Balance Due</span>
                  <span className={cn(settled ? "text-green-600" : "text-amber-600")}>
                    ₹{money(balanceDue)}
                  </span>
                </div>
                {settled && (
                  <p className="text-xs text-green-600 text-center mt-1 font-medium">✓ Fully Paid</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="space-y-2 mt-6">
          <Button className="w-full" onClick={onSave} loading={saving}>
            <Receipt className="w-4 h-4 mr-2" />
            {isEditing ? "Update Bill" : "Create Bill / बिल बनाएं"}
          </Button>
          <Button className="w-full" variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" />Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

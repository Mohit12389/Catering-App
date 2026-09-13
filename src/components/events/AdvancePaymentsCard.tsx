"use client"

import { useState } from "react"
import { Banknote, Calendar, IndianRupee, Plus, Save, Trash2 } from "lucide-react"
import { Button, Input } from "@/components/ui"
import { Card } from "@/components/shared"
import { formatDate, todayLocalDate } from "@/lib/utils"

// =============================================
// ADVANCE PAYMENTS CARD
// =============================================
// CHANGED: lifted out of event-history/[eventId]/page.tsx (~135 lines inline). The
// add-payment form's own state — whether it is open, and the three fields — moved in
// with it, because nothing outside this card ever read it. The page keeps the payment
// list and the handlers that talk to the server, since the running total is a cached
// column kept in step with the rows inside one transaction.
//
// Catering runs on advances: a customer pays in instalments before the event, and the
// owner needs each payment listed AND the remaining balance at a glance.

interface AdvancePayment {
  id: string
  amount: number
  paidDate: string | Date
  notes?: string | null
}

interface AdvancePaymentsCardProps {
  payments: AdvancePayment[]
  total: number
  remaining: number
  isFullyPaid: boolean
  /** The event total; the remaining/fully-paid rows are meaningless without one. */
  eventTotal: number
  /** While the page is in edit mode, adding and deleting are hidden. */
  isEditing: boolean
  /** Resolves true when the payment saved, so this card can clear and close its form. */
  onAdd: (amount: string, paidDate: string, notes: string) => Promise<boolean>
  adding: boolean
  onDelete: (paymentId: string) => void
  deletingPaymentId: string | null
}

export function AdvancePaymentsCard({
  payments, total, remaining, isFullyPaid, eventTotal,
  isEditing, onAdd, adding, onDelete, deletingPaymentId,
}: AdvancePaymentsCardProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [amount, setAmount] = useState("")
  const [paidDate, setPaidDate] = useState("")
  const [notes, setNotes] = useState("")

  const openForm = () => {
    setShowAdd(!showAdd)
    // CHANGED: was new Date().toISOString().split("T")[0] — the UTC day, which is
    // YESTERDAY between 00:00 and 05:30 IST. A payment recorded late at night would
    // have been dated a day early. todayLocalDate() uses the operator's own day.
    if (!paidDate) setPaidDate(todayLocalDate())
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Banknote className="w-5 h-5 text-green-600" />Advance Payments
        </h2>
        {!isEditing && (
          <Button size="sm" onClick={openForm}>
            <Plus className="w-4 h-4 mr-1" />Add
          </Button>
        )}
      </div>

      {/* Add Payment Form */}
      {showAdd && !isEditing && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label mb-1 block text-xs">Amount (₹) *</label>
              <Input
                type="number"
                placeholder="Amount"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="label mb-1 block text-xs">Date *</label>
              <Input
                type="date"
                value={paidDate}
                onChange={e => setPaidDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label mb-1 block text-xs">Notes</label>
            <Input
              placeholder="Cash, UPI..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={async () => {
                const saved = await onAdd(amount, paidDate, notes)
                if (saved) { setAmount(""); setNotes(""); setPaidDate(""); setShowAdd(false) }
              }}
              loading={adding}
              disabled={!amount || !paidDate}
            >
              <Save className="w-4 h-4 mr-1" />Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setShowAdd(false); setAmount(""); setNotes("") }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Payment List */}
      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No advance payments yet</p>
      ) : (
        <div className="space-y-2">
          {payments.map((payment, idx) => (
            <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <div>
                  <p className="font-semibold text-green-700 flex items-center">
                    <IndianRupee className="w-3 h-3" />{payment.amount.toLocaleString("en-IN")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    {formatDate(payment.paidDate)}
                    {payment.notes && ` • ${payment.notes}`}
                  </p>
                </div>
              </div>
              {!isEditing && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  onClick={() => onDelete(payment.id)}
                  loading={deletingPaymentId === payment.id}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          ))}

          {/* Payment Total */}
          <div className="flex justify-between items-center pt-2 border-t mt-2">
            <span className="text-sm font-medium text-muted-foreground">
              Total ({payments.length})
            </span>
            <span className="font-bold text-green-700 flex items-center text-lg">
              <IndianRupee className="w-4 h-4" />{total.toLocaleString("en-IN")}
            </span>
          </div>

          {/* Remaining / Fully Paid indicators */}
          {!isFullyPaid && eventTotal > 0 && (
            <div className="flex justify-between items-center p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <span className="text-amber-700">Remaining</span>
              <span className="font-semibold text-amber-700 flex items-center">
                <IndianRupee className="w-3 h-3" />{remaining.toLocaleString("en-IN")}
              </span>
            </div>
          )}
          {isFullyPaid && (
            <div className="p-2 bg-green-50 border border-green-200 rounded-lg text-center text-sm font-medium text-green-700">
              ✓ Fully Paid
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

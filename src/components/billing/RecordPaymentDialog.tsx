"use client"

import { useEffect, useMemo, useState } from "react"
import { Banknote, IndianRupee, Trash2 } from "lucide-react"
import {
  Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui"
import { formatDate, cn } from "@/lib/utils"
import { allocateWaterfall } from "@/lib/paymentStatus"

// =============================================
// RECORD A PAYMENT AGAINST A BILL
// =============================================
// CHANGED: replaces the "Mark Paid" / "Mark Unpaid" buttons. Those set a status column
// with no amount, no date and no record of what actually happened, and could declare a
// bill settled with nothing behind it. A payment is a dated row now, exactly like the
// advances the app has always tracked properly.
//
// One bill can cover several EVENTS for one customer — the same booking split across
// venues, because the material has to go to different places. The payment arrives as one
// lump, so it is spread across those events earliest-first (allocateWaterfall) and the
// split is shown, EDITABLE, before saving. The operator decides where the money really
// belongs; the app only proposes a sensible starting point and checks the arithmetic.
//
// Sub-events (meals) are never allocated to. Money stops at the event.

/** One AdvancePayment row. A payment covering several events is several rows, one per
 *  event, sharing a groupId — that is what makes it deletable as one thing. */
export interface RecordedPayment {
  id: string
  amount: number
  paidDate: string
  notes?: string | null
  groupId?: string | null
}

export interface PayableEvent {
  id: string
  eventId: string
  organizerName: string
  location?: string | null
  functionDate: string
  totalAmount: number
  advancePayment: number
  balance: number
}

interface RecordPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  billNumber: string
  billTotal: number
  billPaid: number
  events: PayableEvent[]
  /** Payments already recorded against this bill, newest last. */
  payments?: RecordedPayment[]
  saving?: boolean
  onSubmit: (payload: {
    amount: number
    paidDate: string
    notes: string
    allocations: { eventId: string; amount: number }[]
  }) => void
  /** Remove a whole recorded payment — every row it produced. */
  onDelete?: (groupId: string) => void
  deletingGroupId?: string | null
}

const todayStr = () => new Date().toISOString().split("T")[0]

export function RecordPaymentDialog({
  open, onOpenChange, billNumber, billTotal, billPaid, events,
  payments = [], saving, onSubmit, onDelete, deletingGroupId
}: RecordPaymentDialogProps) {
  const [amount, setAmount] = useState("")
  const [paidDate, setPaidDate] = useState(todayStr())
  const [notes, setNotes] = useState("")
  // Per-event amounts, keyed by event id. Empty until the operator types an amount.
  const [split, setSplit] = useState<Record<string, string>>({})
  // Set once the operator edits a row, so the waterfall stops overwriting his numbers.
  const [edited, setEdited] = useState(false)

  const billBalance = Math.max(0, Math.round(billTotal - billPaid))

  // Reset every time the dialog opens, so a previous payment's numbers never linger.
  useEffect(() => {
    if (!open) return
    setAmount("")
    setPaidDate(todayStr())
    setNotes("")
    setSplit({})
    setEdited(false)
  }, [open])

  const parsedAmount = Math.round(parseFloat(amount) || 0)

  // One payment split across two events is two rows. Regroup them so the list shows what
  // was entered — a single ₹3,00,000 on the 5th — rather than its internal halves.
  const recorded = useMemo(() => {
    const groups = new Map<string, { groupId: string; amount: number; paidDate: string; notes?: string | null; rows: number }>()
    for (const p of payments) {
      const key = p.groupId || p.id
      const existing = groups.get(key)
      if (existing) {
        existing.amount += p.amount
        existing.rows += 1
      } else {
        groups.set(key, { groupId: key, amount: p.amount, paidDate: p.paidDate, notes: p.notes, rows: 1 })
      }
    }
    return Array.from(groups.values()).sort(
      (a, b) => new Date(b.paidDate).getTime() - new Date(a.paidDate).getTime()
    )
  }, [payments])

  // The proposal: fill the earliest event's balance, spill the remainder into the next.
  useEffect(() => {
    if (edited || parsedAmount <= 0) return
    const proposed = allocateWaterfall(
      parsedAmount,
      events.map(e => ({ eventId: e.id, balance: e.balance }))
    )
    const next: Record<string, string> = {}
    for (const a of proposed) next[a.eventId] = a.amount ? String(a.amount) : ""
    setSplit(next)
  }, [parsedAmount, events, edited])

  const allocations = useMemo(
    () => events.map(e => ({ eventId: e.id, amount: Math.round(parseFloat(split[e.id] || "0") || 0) })),
    [events, split]
  )
  const allocated = allocations.reduce((sum, a) => sum + a.amount, 0)
  const mismatch = parsedAmount > 0 && allocated !== parsedAmount
  const overpaying = parsedAmount > billBalance && billBalance > 0

  const setRow = (eventId: string, value: string) => {
    setEdited(true)
    setSplit(prev => ({ ...prev, [eventId]: value }))
  }

  const canSave = parsedAmount > 0 && !!paidDate && !mismatch && !saving

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-green-600" />
            Record Payment / भुगतान दर्ज करें
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm p-3 rounded bg-muted/50">
            <span className="font-mono text-muted-foreground">{billNumber}</span>
            <span>
              Balance <span className="font-semibold text-amber-600">₹{billBalance.toLocaleString("en-IN")}</span>
            </span>
          </div>

          {/* CHANGED: recorded payments, with a way to remove one. Without this a
              mistyped amount was permanent — the only correction available was deleting
              the whole bill. */}
          {recorded.length > 0 && (
            <div className="space-y-1">
              <p className="label">Recorded payments / दर्ज भुगतान</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {recorded.map(p => (
                  <div key={p.groupId} className="flex items-center justify-between gap-2 p-2 rounded bg-green-50 border border-green-100 text-xs">
                    <div className="min-w-0">
                      <span className="font-semibold text-green-700">₹{p.amount.toLocaleString("en-IN")}</span>
                      <span className="text-muted-foreground ml-2">{formatDate(p.paidDate)}</span>
                      {p.notes && <span className="text-muted-foreground ml-2 truncate">· {p.notes}</span>}
                      {p.rows > 1 && <span className="text-muted-foreground ml-2">· {p.rows} events</span>}
                    </div>
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive shrink-0"
                        loading={deletingGroupId === p.groupId}
                        onClick={() => onDelete(p.groupId)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Amount / राशि *"
              type="number"
              placeholder="0"
              value={amount}
              onChange={e => { setAmount(e.target.value); setEdited(false) }}
            />
            <Input
              label="Date / तारीख *"
              type="date"
              value={paidDate}
              onChange={e => setPaidDate(e.target.value)}
            />
          </div>

          <Input
            label="Notes / टिप्पणी"
            placeholder="cash / UPI / cheque"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />

          {overpaying && (
            // Warned, never blocked: money genuinely sloshes between the functions of one
            // booking, and an operator who means it should not have to fight the app.
            <p className="text-xs text-amber-600">
              This is more than the bill&apos;s remaining balance of ₹{billBalance.toLocaleString("en-IN")}.
            </p>
          )}

          {events.length > 1 && (
            <div className="space-y-2">
              <p className="label">Split across events / कार्यक्रमों में बाँटें</p>
              <p className="text-xs text-muted-foreground">
                Filled earliest first. Change any number if the customer meant it differently.
              </p>
              <div className="space-y-2">
                {events.map(event => (
                  <div key={event.id} className="flex items-center gap-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{formatDate(event.functionDate)}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {event.location || event.organizerName} · balance ₹{event.balance.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <Input
                      type="number"
                      className="h-9 w-32"
                      placeholder="0"
                      value={split[event.id] || ""}
                      onChange={e => setRow(event.id, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <div className={cn(
                "flex justify-between text-sm pt-2 border-t",
                mismatch ? "text-destructive font-semibold" : "text-muted-foreground"
              )}>
                <span>Allocated</span>
                <span className="flex items-center">
                  <IndianRupee className="w-3 h-3" />{allocated.toLocaleString("en-IN")}
                  {mismatch && <span className="ml-2">≠ ₹{parsedAmount.toLocaleString("en-IN")}</span>}
                </span>
              </div>
            </div>
          )}

          {events.length === 0 && (
            <p className="text-xs text-destructive">
              This bill is not linked to any event, so a payment cannot be recorded against it.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!canSave || events.length === 0}
            loading={saving}
            onClick={() => onSubmit({ amount: parsedAmount, paidDate, notes, allocations })}
          >
            <Banknote className="w-4 h-4 mr-2" />Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

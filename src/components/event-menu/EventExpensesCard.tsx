"use client"

// =============================================
// EVENT EXPENSES (transport, layout, waiters…)
// =============================================
// CHANGED: new. The caterer's own non-ingredient costs for ONE event, typed on the
// Event Menu page and saved by that page's Save button (the page owns the rows).
// Amount = qty × rate, worked out here and on the revenue page — never stored.

import { useId, useRef, useState } from "react"
import { Plus, Trash2, Truck, IndianRupee } from "lucide-react"
import { Button } from "@/components/ui"
import { api } from "@/lib/apiClient"

/** One row as typed — numbers stay strings so a half-typed "12." isn't lost. */
export interface ExpenseDraft {
  key: string
  name: string
  quantity: string
  rate: string
  notes: string
}

// Offered even before anything is saved; names used before are added to these.
const STARTER_NAMES = ["Waiters / वेटर", "Transport / ट्रांसपोर्ट", "Layout / Tent / टेंट", "Labour / मजदूर"]

export const expenseAmount = (r: Pick<ExpenseDraft, "quantity" | "rate">) =>
  (Number(r.quantity) || 0) * (Number(r.rate) || 0)

let keySeq = 0
export const newExpenseKey = () => `exp-${Date.now()}-${keySeq++}`

interface EventExpensesCardProps {
  rows: ExpenseDraft[]
  onChange: (rows: ExpenseDraft[]) => void
}

export function EventExpensesCard({ rows, onChange }: EventExpensesCardProps) {
  const listId = useId()
  const [names, setNames] = useState<string[]>(STARTER_NAMES)
  const namesLoaded = useRef(false)

  // Past names are fetched on first focus of a name box, not on page load.
  const loadNames = () => {
    if (namesLoaded.current) return
    namesLoaded.current = true
    api.get<string[]>("/api/expenses/names")
      .then(used => setNames(Array.from(new Set([...used, ...STARTER_NAMES]))))
      .catch(() => { namesLoaded.current = false })
  }

  const update = (key: string, patch: Partial<ExpenseDraft>) =>
    onChange(rows.map(r => (r.key === key ? { ...r, ...patch } : r)))
  const add = () => onChange([...rows, { key: newExpenseKey(), name: "", quantity: "1", rate: "", notes: "" }])
  // No confirm: a removed row only disappears for real when Save is pressed.
  const remove = (key: string) => onChange(rows.filter(r => r.key !== key))

  const total = rows.reduce((s, r) => s + expenseAmount(r), 0)

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-secondary" />
          <span className="font-semibold text-lg">Event Expenses / इवेंट खर्च</span>
        </div>
        <span className="text-sm text-muted-foreground">Transport, layout, waiters — your cost, not on the bill</span>
      </div>

      <datalist id={listId}>
        {names.map(n => <option key={n} value={n} />)}
      </datalist>

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium py-1 pr-2">Expense / खर्च</th>
                <th className="text-left font-medium py-1 px-2 w-24">Qty</th>
                <th className="text-left font-medium py-1 px-2 w-28">Rate (₹)</th>
                <th className="text-right font-medium py-1 px-2 w-28">Amount</th>
                <th className="text-left font-medium py-1 px-2">Note / नोट</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key}>
                  <td className="py-1 pr-2">
                    <input
                      className="input h-8 w-full min-w-[140px]"
                      list={listId}
                      placeholder="e.g. Waiters / वेटर"
                      value={r.name}
                      onFocus={loadNames}
                      onChange={e => update(r.key, { name: e.target.value })}
                    />
                  </td>
                  <td className="py-1 px-2">
                    <input type="number" min={0} step="any" inputMode="decimal" className="input h-8 w-full text-right"
                      value={r.quantity} onChange={e => update(r.key, { quantity: e.target.value })}
                      onWheel={e => e.currentTarget.blur()} />
                  </td>
                  <td className="py-1 px-2">
                    <input type="number" min={0} step="any" inputMode="decimal" className="input h-8 w-full text-right"
                      value={r.rate} onChange={e => update(r.key, { rate: e.target.value })}
                      onWheel={e => e.currentTarget.blur()} />
                  </td>
                  <td className="py-1 px-2 text-right font-medium whitespace-nowrap">
                    ₹{expenseAmount(r).toLocaleString("en-IN")}
                  </td>
                  <td className="py-1 px-2">
                    <input className="input h-8 w-full min-w-[120px]" placeholder="e.g. 2 trips"
                      value={r.notes} onChange={e => update(r.key, { notes: e.target.value })} />
                  </td>
                  <td className="py-1 text-right">
                    <button type="button" aria-label="Remove expense" onClick={() => remove(r.key)}
                      className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <Button variant="outline" size="sm" className="border-dashed" onClick={add}>
          <Plus className="w-4 h-4 mr-1" />Add Expense / खर्च जोड़ें
        </Button>
        {rows.length > 0 && (
          <span className="text-sm font-semibold flex items-center">
            Total: <IndianRupee className="w-3.5 h-3.5 ml-1" />{total.toLocaleString("en-IN")}
          </span>
        )}
      </div>
    </div>
  )
}

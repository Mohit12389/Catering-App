// =============================================
// DERIVED PAYMENT & EVENT-STAGE RULES
// =============================================
// CHANGED: new module. Payment state used to live in two unconnected places —
// AdvancePayment rows (transactionally summed into Event.advancePayment) and a
// Bill.paidAmount scalar flipped by a "Mark Paid" button. The same rupees had two
// representations that could disagree, which is the green-bar bug from CLAUDE.md
// repeated at a larger scale.
//
// The fix CLAUDE.md already names as the correct design: derive status from the
// amounts instead of storing it. Nothing here reads or writes a status column —
// every value is computed from money, dates and whether a bill exists.

export type PaymentStatus = "paid" | "partial" | "unpaid" | "none"

// Event lifecycle. Only "cancelled" is a human decision stored on Event.status;
// the rest are computed. See stage rules in eventStage() below.
//
// CHANGED: "billed" is no longer a stage. It used to sit in this list and swallow the
// timeline — once an event was invoiced its row stopped saying whether it had actually
// happened, which is the thing the operator scans for. Billed is an independent fact
// about an event (is there an invoice?) and now has its own column.
export type EventStage = "upcoming" | "done" | "completed" | "cancelled"

// -------------------------------------------------
// Money
// -------------------------------------------------

/**
 * RULE: paid / partial / unpaid is a comparison, never a stored flag.
 *
 * "none" means there is nothing to pay yet (no quote, no bill) — the history table
 * shows a dash rather than calling a ₹0 event "Paid".
 *
 * Rounded to whole rupees before comparing: a per-plate total can land a fraction of
 * a paisa short of the receivable (guests x price in floating point), which would
 * leave a fully-settled event showing "Partial" forever.
 */
export function paymentStatusOf(paid: number, receivable: number): PaymentStatus {
  const due = Math.round(receivable || 0)
  const got = Math.round(paid || 0)
  if (due <= 0) return "none"
  if (got >= due) return "paid"
  if (got > 0) return "partial"
  return "unpaid"
}

/** Outstanding amount, never negative — an overpaid event owes nothing, not a refund. */
export function balanceOf(paid: number, receivable: number): number {
  return Math.max(0, Math.round((receivable || 0) - (paid || 0)))
}

// -------------------------------------------------
// Dates
// -------------------------------------------------

// Date-only string, matching how mealKey() normalises dates everywhere else.
function toDateStr(value: Date | string): string {
  return (value instanceof Date ? value.toISOString() : String(value)).split("T")[0]
}

/**
 * RULE: an event has happened once its LAST meal date has passed — not functionDate,
 * which is the EARLIEST meal date and exists to drive the "next event first" sort.
 * Use latestMealDate() from eventRules.ts to get the date to pass in here.
 *
 * Compared as date strings so a meal stored at midnight UTC isn't "done" merely
 * because some hours have elapsed. An event is still in progress on its own last day.
 */
export function hasHappened(
  lastMealDate: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!lastMealDate) return false
  const last = new Date(lastMealDate)
  if (Number.isNaN(last.getTime())) return false
  return toDateStr(last) < toDateStr(now)
}

// -------------------------------------------------
// Stage
// -------------------------------------------------

/**
 * RULE: Completed = Done AND Billed AND Paid — all three.
 *
 * All three matter. A wedding paid in full in March for a December function is not
 * "completed" in September: the food has not been served. And an event fully covered
 * by advances but never invoiced is not finished either, because the invoice still has
 * to be issued.
 *
 * Everything short of that is either Upcoming or Done — the timeline — with "is it
 * billed?" reported separately rather than overwriting it.
 *
 * Order is deliberate: cancelled beats everything, because it is the one stored human
 * decision and it stops the event being any of the others.
 */
export function eventStage(input: {
  /** Event.status from the database — only "cancelled" is consulted. */
  storedStatus?: string | null
  /** Latest sub-event date; see latestMealDate(). */
  lastMealDate?: Date | string | null
  /** Does a BillItem point at this event? */
  isBilled: boolean
  paymentStatus: PaymentStatus
  now?: Date
}): EventStage {
  if (input.storedStatus === "cancelled") return "cancelled"

  const done = hasHappened(input.lastMealDate, input.now ?? new Date())

  if (done && input.isBilled && input.paymentStatus === "paid") return "completed"
  if (done) return "done"
  return "upcoming"
}

/**
 * The stages that mean "this booking is still live work" — it has not been closed out
 * and it has not been called off.
 *
 * Exists because the operator scans for these two TOGETHER: everything still on his
 * plate, whether the function is next week or happened last month and is waiting to be
 * settled. Splitting them across two filter choices made him look twice.
 */
export const ACTIVE_STAGES: EventStage[] = ["upcoming", "done"]

export function isActiveStage(stage: EventStage): boolean {
  return ACTIVE_STAGES.includes(stage)
}

// -------------------------------------------------
// Labels — bilingual, as every other label in this app is.
// -------------------------------------------------

export const STAGE_LABELS: Record<EventStage, string> = {
  upcoming: "Upcoming / आगामी",
  done: "Done / हो गया",
  completed: "Completed / पूर्ण",
  cancelled: "Cancelled / रद्द"
}

// Short form for the dense history table, where a bilingual label would not fit.
export const STAGE_SHORT: Record<EventStage, string> = {
  upcoming: "Upcoming",
  done: "Done",
  completed: "Completed",
  cancelled: "Cancelled"
}

export const STAGE_VARIANTS: Record<EventStage, string> = {
  upcoming: "secondary",
  done: "warning",      // happened and not closed out — the actionable one
  completed: "success",
  cancelled: "destructive"
}

export const PAYMENT_VARIANTS: Record<PaymentStatus, string> = {
  paid: "success",
  partial: "warning",
  unpaid: "destructive",
  none: "secondary"
}

export const PAYMENT_SHORT: Record<PaymentStatus, string> = {
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
  none: "—"
}

// -------------------------------------------------
// Waterfall allocation
// -------------------------------------------------

export interface AllocationTarget {
  eventId: string
  /** What this event still owes before this payment. */
  balance: number
}

export interface Allocation {
  eventId: string
  amount: number
}

/**
 * RULE: one bill can cover several EVENTS for the same customer (the same booking
 * split across venues — the home functions and the wedding hall are separate events
 * because the material goes to different places). A payment arrives as one lump, so
 * it is spread across those events EARLIEST FIRST: fill an event's balance, spill the
 * remainder into the next.
 *
 * Sub-events (meals) are never allocated to. Money stops at the event; a meal has no
 * balance of its own.
 *
 * This is a SUGGESTION, not a rule the app enforces. The record-payment dialog shows
 * the split and lets the operator type over it, because he allocates by knowing what
 * the customer meant — the same principle as the shared-ingredient flag, which
 * proposes and lets a human set the real number.
 *
 * Callers pass targets already sorted earliest-first. Any remainder beyond every
 * balance lands on the LAST event rather than vanishing, so the returned amounts
 * always sum to exactly what was paid.
 */
export function allocateWaterfall(
  amount: number,
  targets: AllocationTarget[]
): Allocation[] {
  if (targets.length === 0) return []

  let left = Math.round(amount || 0)
  const out: Allocation[] = targets.map(t => ({ eventId: t.eventId, amount: 0 }))

  for (let i = 0; i < targets.length && left > 0; i++) {
    const take = Math.min(left, Math.max(0, Math.round(targets[i].balance || 0)))
    out[i].amount = take
    left -= take
  }

  // Overpayment: the customer has paid more than the bill's events owe. Keep it on
  // the last event instead of silently dropping rupees — the dialog warns rather than
  // blocking, because money genuinely sloshes between functions in one booking.
  if (left > 0) out[out.length - 1].amount += left

  return out
}

// -------------------------------------------------
// What a billed event actually owes
// -------------------------------------------------

/**
 * RULE: once an event is on a bill, the BILL decides what it owes — not the quote.
 *
 * Event.totalAmount is guests x per-plate: an estimate, and the app's own printed menu
 * tells the client it will move with the final headcount. The invoice is where that
 * number stops moving, and it is also where a discount or GST is applied. So a customer
 * who pays the discounted total in full was leaving his event stuck on "Partial" — the
 * history page was comparing his payment against the pre-discount quote.
 *
 * The bill total is split across the events it covers in proportion to what each
 * contributed to the bill (the sum of its BillItem amounts). That distributes discount
 * and tax the only way that is defensible: proportionally. Whole rupees, with the
 * rounding remainder given to the last event so the shares add up to the bill exactly.
 *
 * A bill whose items total zero cannot be apportioned; callers fall back to the quote.
 */
export function billedSharesOf(
  billTotal: number,
  items: { eventId: string | null; amount: number }[]
): Map<string, number> {
  const perEvent = new Map<string, number>()
  for (const item of items) {
    if (!item.eventId) continue
    perEvent.set(item.eventId, (perEvent.get(item.eventId) || 0) + (item.amount || 0))
  }

  const itemsTotal = Array.from(perEvent.values()).reduce((sum, v) => sum + v, 0)
  const out = new Map<string, number>()
  if (perEvent.size === 0 || itemsTotal <= 0) return out

  const ids = Array.from(perEvent.keys())
  let assigned = 0
  ids.forEach((id, i) => {
    if (i === ids.length - 1) {
      out.set(id, Math.round(billTotal) - assigned)
    } else {
      const share = Math.round((perEvent.get(id)! / itemsTotal) * billTotal)
      out.set(id, share)
      assigned += share
    }
  })
  return out
}

// =============================================
// WHICH EVENTS ARE BILLED, AND FOR HOW MUCH
// =============================================
// CHANGED: new module. Three routes needed the same two facts — does this event have an
// invoice, and what does that invoice say it owes — and a business rule living in three
// places is three chances to get it wrong (CLAUDE.md). This is the one implementation.
//
// BillItem.eventId has always been written and never read back. Reading it is what makes
// "billed" derivable without storing a flag someone has to remember to set, and what
// lets a bill's discount reach the event history page.

import { prisma } from "@/lib/prisma"
import { billedSharesOf } from "@/lib/paymentStatus"

export interface EventBilling {
  billId: string
  billNumber: string
  /** This event's share of the bill total, AFTER discount and tax. */
  amount: number
  // CHANGED: the breakdown behind that figure, so the event page can SHOW the discount
  // rather than silently presenting a smaller number than the menu quoted. An operator
  // who sees ₹540,000 where he quoted ₹600,000 needs to be told why on the same screen.
  /** This event's own line items on the bill, before discount and tax. */
  itemsTotal: number
  /** This event's share of the bill's discount (0 when there is none). */
  discountAmount: number
  /** This event's share of the bill's SGST + CGST (0 when there is none). */
  taxAmount: number
}

/**
 * For each of the given events, the most recent bill covering it and that event's share
 * of the bill's total.
 *
 * Most recent wins: reissuing a corrected invoice is a normal thing for a caterer to do,
 * and the corrected one is the one that counts.
 */
export async function billingByEvent(
  eventIds: string[],
  userId: string
): Promise<Map<string, EventBilling>> {
  const out = new Map<string, EventBilling>()
  if (eventIds.length === 0) return out

  // CHANGED: a Set, not the array. This is checked once per event PER BILL, so on the
  // history page — every event of the business, every bill touching them — Array.includes
  // made the lookup quadratic in the number of events.
  const wanted = new Set(eventIds)

  // Every item of every bill that touches these events — the whole bill, not just the
  // matching rows, because a share is only meaningful against the bill's full contents.
  const bills = await prisma.bill.findMany({
    where: { userId, items: { some: { eventId: { in: eventIds } } } },
    select: {
      id: true, billNumber: true, billDate: true,
      subtotal: true, discountAmount: true, totalAmount: true,
      items: { select: { eventId: true, amount: true } }
    },
    orderBy: { billDate: "desc" }
  })

  for (const bill of bills) {
    const shares = billedSharesOf(bill.totalAmount, bill.items)

    // Each event's own line items, and its weight within the bill. The discount and the
    // tax are split on that same weight, so the parts always describe the whole.
    const itemsByEvent = new Map<string, number>()
    for (const item of bill.items) {
      if (!item.eventId) continue
      itemsByEvent.set(item.eventId, (itemsByEvent.get(item.eventId) || 0) + (item.amount || 0))
    }
    const itemsTotalAll = Array.from(itemsByEvent.values()).reduce((sum, v) => sum + v, 0)

    // Total tax on the bill = what is left once the discounted subtotal is taken off.
    const totalTax = (bill.totalAmount || 0) - ((bill.subtotal || 0) - (bill.discountAmount || 0))

    for (const eventId of Array.from(shares.keys())) {
      // Bills come newest first, so the first one to claim an event is the current one.
      if (!wanted.has(eventId) || out.has(eventId)) continue
      const itemsTotal = itemsByEvent.get(eventId) || 0
      const weight = itemsTotalAll > 0 ? itemsTotal / itemsTotalAll : 0
      out.set(eventId, {
        billId: bill.id,
        billNumber: bill.billNumber,
        amount: shares.get(eventId)!,
        itemsTotal: Math.round(itemsTotal),
        discountAmount: Math.round(weight * (bill.discountAmount || 0)),
        taxAmount: Math.round(weight * totalTax)
      })
    }
  }

  return out
}

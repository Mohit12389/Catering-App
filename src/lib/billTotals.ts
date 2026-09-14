// =============================================
// WHAT A BILL ADDS UP TO
// =============================================
// CHANGED: new module. Subtotal → discount → tax → total was written out three times:
// in POST /api/bills, in the PUT that edits a bill, and again in the composer's summary
// panel. CLAUDE.md is explicit that a business rule living in several places is several
// chances to get it wrong — and this one decides what a customer is invoiced.
//
// The server stays authoritative: the composer shows what the operator is about to
// create, and the route recomputes it from the submitted items. They agree because they
// are now the same function, not because someone kept two copies in step.

import { toAmount } from "@/lib/utils"

export interface BillTotalsInput {
  items: { quantity: number | string; rate: number | string }[]
  /** "percentage" | "fixed" | "none" | null — anything else means no discount. */
  discountType?: string | null
  discountValue?: number | string | null
  /** Percentages, not amounts. */
  sgst?: number | string | null
  cgst?: number | string | null
}

export interface BillTotals {
  subtotal: number
  discountAmount: number
  afterDiscount: number
  sgstAmount: number
  cgstAmount: number
  totalAmount: number
}

/**
 * RULE: tax is charged on the DISCOUNTED amount, not the subtotal — the discount comes
 * off first, then SGST and CGST apply to what is left.
 *
 * Every figure goes through toAmount(), so a blank or half-typed input reads as 0 rather
 * than turning the whole bill into NaN. That is the failure this route was hardened
 * against before: a NaN total is saved silently and shows as "₹NaN" on the invoice.
 */
export function billTotals(input: BillTotalsInput): BillTotals {
  const subtotal = input.items.reduce(
    (sum, item) => sum + toAmount(item.quantity) * toAmount(item.rate),
    0
  )

  const discountValue = toAmount(input.discountValue)
  let discountAmount = 0
  if (input.discountType === "percentage") {
    discountAmount = (subtotal * discountValue) / 100
  } else if (input.discountType === "fixed") {
    discountAmount = discountValue
  }

  const afterDiscount = subtotal - discountAmount
  const sgstAmount = (afterDiscount * toAmount(input.sgst)) / 100
  const cgstAmount = (afterDiscount * toAmount(input.cgst)) / 100

  return {
    subtotal,
    discountAmount,
    afterDiscount,
    sgstAmount,
    cgstAmount,
    totalAmount: afterDiscount + sgstAmount + cgstAmount
  }
}

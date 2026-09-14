import { describe, it, expect } from "vitest"
import { billTotals } from "./billTotals"

const items = [
  { quantity: 200, rate: 600 },   // 1,20,000
  { quantity: 800, rate: 600 },   // 4,80,000
]

describe("billTotals", () => {
  it("adds up the line items", () => {
    expect(billTotals({ items }).subtotal).toBe(600000)
    expect(billTotals({ items }).totalAmount).toBe(600000)
  })

  it("takes a percentage discount off the subtotal", () => {
    const t = billTotals({ items, discountType: "percentage", discountValue: 10 })
    expect(t.discountAmount).toBe(60000)
    expect(t.totalAmount).toBe(540000)
  })

  it("takes a fixed discount as an amount, not a percentage", () => {
    const t = billTotals({ items, discountType: "fixed", discountValue: 50000 })
    expect(t.discountAmount).toBe(50000)
    expect(t.totalAmount).toBe(550000)
  })

  it("ignores a discount value with no type chosen", () => {
    for (const discountType of [null, undefined, "", "none"]) {
      expect(billTotals({ items, discountType, discountValue: 50000 }).totalAmount).toBe(600000)
    }
  })

  it("charges tax on the DISCOUNTED amount, not the subtotal", () => {
    // 6,00,000 − 60,000 = 5,40,000, then 2.5% + 2.5% on that = 27,000.
    // Taxing the subtotal instead would over-charge the customer by ₹3,000.
    const t = billTotals({ items, discountType: "percentage", discountValue: 10, sgst: 2.5, cgst: 2.5 })
    expect(t.sgstAmount).toBe(13500)
    expect(t.cgstAmount).toBe(13500)
    expect(t.totalAmount).toBe(567000)
  })

  it("reads blank and half-typed inputs as zero instead of NaN", () => {
    // These come straight from text inputs. A NaN total is saved silently and prints
    // "₹NaN" on the customer's invoice.
    const t = billTotals({
      items: [{ quantity: "", rate: "600" }, { quantity: "200", rate: "-" }],
      discountType: "percentage", discountValue: "", sgst: "", cgst: undefined,
    })
    expect(t.subtotal).toBe(0)
    expect(t.totalAmount).toBe(0)
    expect(Number.isNaN(t.totalAmount)).toBe(false)
  })

  it("handles an empty bill", () => {
    expect(billTotals({ items: [] }).totalAmount).toBe(0)
  })
})

import { describe, it, expect } from "vitest"
import { toAmount } from "./utils"

// The bill routes multiply quantity * rate straight off the parsed request body.
// Before toAmount, a missing or non-numeric value produced NaN and NaN was saved
// as the bill total — a wrong invoice for a real wedding.
describe("toAmount", () => {
  it("passes real numbers through untouched", () => {
    expect(toAmount(250)).toBe(250)
    expect(toAmount(0)).toBe(0)
    expect(toAmount(12.5)).toBe(12.5)
  })

  it("accepts numeric strings, which is how form values arrive", () => {
    expect(toAmount("250")).toBe(250)
    expect(toAmount("12.5")).toBe(12.5)
  })

  it("turns every NaN-producing value into 0 instead", () => {
    for (const bad of [undefined, null, "", "   ", "abc", {}, [], NaN]) {
      expect(toAmount(bad)).toBe(0)
    }
  })

  it("keeps a total finite when an item is malformed", () => {
    const items = [
      { quantity: 2, rate: 100 },
      { quantity: undefined, rate: "abc" },
    ]
    const subtotal = items.reduce(
      (sum, i) => sum + toAmount(i.quantity) * toAmount(i.rate), 0
    )
    expect(subtotal).toBe(200)
    expect(Number.isNaN(subtotal)).toBe(false)
  })

  it("preserves a negative value rather than zeroing it", () => {
    // A negative discount or adjustment is the caller's business, not ours.
    expect(toAmount(-50)).toBe(-50)
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { validateBody } from "./validate"
import { billSchema, advancePaymentSchema, categoryPaymentSchema } from "./schemas"

beforeEach(() => {
  // spyOn returns the SAME spy if already spied, so clear accumulated calls
  vi.spyOn(console, "warn").mockImplementation(() => {}).mockClear()
  vi.spyOn(console, "error").mockImplementation(() => {}).mockClear()
})

const validBill = {
  customerName: "Sharma ji", phoneNumber: "9876543210",
  items: [{ description: "Wedding catering", quantity: 200, rate: 500 }],
  discountValue: 0, sgst: 2.5, cgst: 2.5,
}

describe("validateBody — log-only mode (the default)", () => {
  it("passes valid input through as parsed data", () => {
    const r = validateBody(billSchema, validBill, "test")
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.customerName).toBe("Sharma ji")
  })

  it("does NOT reject invalid input — it warns and passes the raw body through unchanged", () => {
    // this is what makes the rollout safe: behaviour is bit-for-bit preserved
    const bad = { customerName: "", items: [] }
    const r = validateBody(billSchema, bad, "test")
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data).toBe(bad)          // same object reference
    expect(console.warn).toHaveBeenCalledOnce()
  })

  it("logs the offending field so you can see what real traffic looks like", () => {
    validateBody(billSchema, { ...validBill, items: [] }, "POST /api/bills")
    const msg = (console.warn as any).mock.calls[0][0]
    expect(msg).toContain("POST /api/bills")
    expect(msg).toContain("items")
  })
})

describe("billSchema catches the NaN-total bug class", () => {
  it("flags a missing rate (quantity * undefined => NaN => NaN bill total)", () => {
    const r = billSchema.safeParse({ ...validBill, items: [{ description: "x", quantity: 200 }] })
    expect(r.success).toBe(false)
  })

  it("flags a non-numeric quantity", () => {
    const r = billSchema.safeParse({ ...validBill, items: [{ description: "x", quantity: "abc", rate: 500 }] })
    expect(r.success).toBe(false)
  })

  it("still ACCEPTS numeric strings, which the frontend really sends", () => {
    const r = billSchema.safeParse({ ...validBill, items: [{ description: "x", quantity: "200", rate: "500" }] })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.items[0].quantity).toBe(200)
  })

  it("defaults discount/sgst/cgst to 0 rather than letting undefined reach the maths", () => {
    const { discountValue, sgst, cgst, ...noNumbers } = validBill
    const r = billSchema.safeParse(noNumbers)
    expect(r.success).toBe(true)
    if (r.success) expect([r.data.discountValue, r.data.sgst, r.data.cgst]).toEqual([0, 0, 0])
  })

  it("rejects an empty item list", () => {
    expect(billSchema.safeParse({ ...validBill, items: [] }).success).toBe(false)
  })
})

describe("advancePaymentSchema", () => {
  it("rejects a zero or negative amount", () => {
    const base = { eventId: "e1", paidDate: "2026-03-20" }
    expect(advancePaymentSchema.safeParse({ ...base, amount: 0 }).success).toBe(false)
    expect(advancePaymentSchema.safeParse({ ...base, amount: -5 }).success).toBe(false)
    expect(advancePaymentSchema.safeParse({ ...base, amount: 5000 }).success).toBe(true)
  })

  it("accepts an amount sent as a string", () => {
    const r = advancePaymentSchema.safeParse({ eventId: "e1", paidDate: "2026-03-20", amount: "5000" })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.amount).toBe(5000)
  })
})

describe("categoryPaymentSchema", () => {
  it("requires a non-empty eventIds array", () => {
    const base = { ingredientCategoryId: "c1", categoryName: "Ration" }
    expect(categoryPaymentSchema.safeParse({ ...base, eventIds: [] }).success).toBe(false)
    expect(categoryPaymentSchema.safeParse({ ...base, eventIds: ["e1"] }).success).toBe(true)
  })

  it("does not accept a client-supplied amount (it is computed server-side)", () => {
    const r = categoryPaymentSchema.safeParse({
      eventIds: ["e1"], ingredientCategoryId: "c1", categoryName: "Ration", amount: 999999
    })
    expect(r.success).toBe(true)
    expect(r.success && "amount" in r.data).toBe(false)
  })
})

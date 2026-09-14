import { describe, it, expect } from "vitest"
import {
  paymentStatusOf, balanceOf, hasHappened, eventStage, allocateWaterfall,
  isActiveStage, billedSharesOf
} from "./paymentStatus"

const d = (s: string) => `${s}T00:00:00.000Z`

describe("paymentStatusOf", () => {
  it("derives the three states from the amounts", () => {
    expect(paymentStatusOf(0, 100000)).toBe("unpaid")
    expect(paymentStatusOf(40000, 100000)).toBe("partial")
    expect(paymentStatusOf(100000, 100000)).toBe("paid")
  })

  it("treats an overpayment as paid, not as some fourth state", () => {
    expect(paymentStatusOf(120000, 100000)).toBe("paid")
  })

  it("reports nothing-to-pay rather than calling a zero event paid", () => {
    // An event with no meals priced yet has totalAmount 0. Showing "Paid ✓" there
    // would tell the operator a booking is settled before it has even been quoted.
    expect(paymentStatusOf(0, 0)).toBe("none")
  })

  it("does not leave a settled event stuck on Partial from float drift", () => {
    // guests x per-plate in floating point can land a fraction short of the total.
    expect(paymentStatusOf(99999.9999, 100000)).toBe("paid")
  })
})

describe("balanceOf", () => {
  it("returns what is still owed", () => {
    expect(balanceOf(40000, 100000)).toBe(60000)
  })

  it("never returns a negative balance", () => {
    expect(balanceOf(120000, 100000)).toBe(0)
  })
})

describe("hasHappened", () => {
  const now = new Date(d("2026-11-21"))

  it("is false on the event's own last day", () => {
    // A wedding is not over while its dinner is still being cooked.
    expect(hasHappened(d("2026-11-21"), now)).toBe(false)
  })

  it("is true once the last day has passed", () => {
    expect(hasHappened(d("2026-11-20"), now)).toBe(true)
  })

  it("is false for a future event", () => {
    expect(hasHappened(d("2026-12-01"), now)).toBe(false)
  })

  it("is false when there is no usable date", () => {
    expect(hasHappened(null, now)).toBe(false)
    expect(hasHappened(undefined, now)).toBe(false)
    expect(hasHappened("rubbish", now)).toBe(false)
  })
})

describe("eventStage", () => {
  const now = new Date(d("2026-11-25"))
  const past = d("2026-11-20")
  const future = d("2026-12-20")

  it("is upcoming before the event happens", () => {
    expect(eventStage({ lastMealDate: future, isBilled: false, paymentStatus: "unpaid", now }))
      .toBe("upcoming")
  })

  it("is done once it has happened but has no bill — the needs-an-invoice state", () => {
    expect(eventStage({ lastMealDate: past, isBilled: false, paymentStatus: "unpaid", now }))
      .toBe("done")
  })

  it("stays done when advances cover it in full but no bill was ever raised", () => {
    // The invoice still has to be issued, so this must not disappear off the
    // needs-billing list just because the money arrived.
    expect(eventStage({ lastMealDate: past, isBilled: false, paymentStatus: "paid", now }))
      .toBe("done")
  })

  it("still reports the timeline once an event is billed", () => {
    // Billed is NOT a stage. It used to be, and it swallowed the timeline: an invoiced
    // event stopped saying whether the function had happened, which is the thing the
    // operator is scanning for.
    expect(eventStage({ lastMealDate: past, isBilled: true, paymentStatus: "partial", now }))
      .toBe("done")
    expect(eventStage({ lastMealDate: future, isBilled: true, paymentStatus: "partial", now }))
      .toBe("upcoming")
  })

  it("is completed only when done AND billed AND paid", () => {
    expect(eventStage({ lastMealDate: past, isBilled: true, paymentStatus: "paid", now }))
      .toBe("completed")
  })

  it("is not completed when a future event is already billed and paid in full", () => {
    // Prepaid in March for a December wedding: the food has not been served.
    expect(eventStage({ lastMealDate: future, isBilled: true, paymentStatus: "paid", now }))
      .toBe("upcoming")
  })

  it("lets cancelled beat every derived state", () => {
    expect(eventStage({
      storedStatus: "cancelled", lastMealDate: past, isBilled: true, paymentStatus: "paid", now
    })).toBe("cancelled")
  })

  it("ignores the legacy stored statuses that are now derived", () => {
    // Existing rows carry status "active"/"completed". Only "cancelled" is consulted,
    // so an old row wrongly left on "completed" no longer lies to the operator.
    expect(eventStage({
      storedStatus: "completed", lastMealDate: past, isBilled: false, paymentStatus: "unpaid", now
    })).toBe("done")
  })
})

describe("allocateWaterfall", () => {
  // One booking, two events: the home functions and the wedding venue.
  const targets = [
    { eventId: "home", balance: 120000 },
    { eventId: "venue", balance: 500000 }
  ]

  it("fills the earliest event first and spills the rest into the next", () => {
    expect(allocateWaterfall(300000, targets)).toEqual([
      { eventId: "home", amount: 120000 },
      { eventId: "venue", amount: 180000 }
    ])
  })

  it("stops at the first event when the payment does not fill it", () => {
    expect(allocateWaterfall(50000, targets)).toEqual([
      { eventId: "home", amount: 50000 },
      { eventId: "venue", amount: 0 }
    ])
  })

  it("always sums to exactly the amount paid", () => {
    for (const amount of [1, 50000, 120000, 300000, 620000]) {
      const total = allocateWaterfall(amount, targets).reduce((s, a) => s + a.amount, 0)
      expect(total).toBe(amount)
    }
  })

  it("keeps an overpayment on the last event instead of dropping rupees", () => {
    expect(allocateWaterfall(700000, targets)).toEqual([
      { eventId: "home", amount: 120000 },
      { eventId: "venue", amount: 580000 }
    ])
  })

  it("skips events that are already settled", () => {
    const settled = [
      { eventId: "home", balance: 0 },
      { eventId: "venue", balance: 500000 }
    ]
    expect(allocateWaterfall(200000, settled)).toEqual([
      { eventId: "home", amount: 0 },
      { eventId: "venue", amount: 200000 }
    ])
  })

  it("returns nothing when there is nothing to allocate to", () => {
    expect(allocateWaterfall(100000, [])).toEqual([])
  })
})

describe("isActiveStage", () => {
  it("groups the two stages that are still live work", () => {
    // The operator scans for everything still on his plate in one go — next week's
    // function and last month's unsettled one are the same kind of open item to him.
    expect(isActiveStage("upcoming")).toBe(true)
    expect(isActiveStage("done")).toBe(true)
    expect(isActiveStage("completed")).toBe(false)
    expect(isActiveStage("cancelled")).toBe(false)
  })
})

describe("billedSharesOf", () => {
  // One bill, two events: the home functions and the wedding venue.
  const items = [
    { eventId: "home", amount: 120000 },
    { eventId: "venue", amount: 480000 }
  ]

  it("passes a bill's discount through to each event", () => {
    // ₹600,000 of items billed at ₹540,000 after a 10% discount. Without this, an event
    // paid in full at the discounted price stayed stuck on "Partial" in the history table,
    // because that page was comparing the payment against the pre-discount quote.
    const shares = billedSharesOf(540000, items)
    expect(shares.get("home")).toBe(108000)
    expect(shares.get("venue")).toBe(432000)
  })

  it("passes tax through the same way", () => {
    const shares = billedSharesOf(630000, items)   // +5% GST
    expect(shares.get("home")).toBe(126000)
    expect(shares.get("venue")).toBe(504000)
  })

  it("is a no-op when the bill has no discount or tax", () => {
    const shares = billedSharesOf(600000, items)
    expect(shares.get("home")).toBe(120000)
    expect(shares.get("venue")).toBe(480000)
  })

  it("always adds up to the bill total, whatever the rounding", () => {
    // Thirds of an odd total: rounding each share independently would lose a rupee, and
    // a bill that can never be filled to zero can never be marked paid.
    const thirds = [
      { eventId: "a", amount: 1 },
      { eventId: "b", amount: 1 },
      { eventId: "c", amount: 1 }
    ]
    for (const total of [100001, 99999, 7, 543211]) {
      const shares = billedSharesOf(total, thirds)
      const sum = Array.from(shares.values()).reduce((a, b) => a + b, 0)
      expect(sum).toBe(total)
    }
  })

  it("sums an event's rows, so a multi-meal event gets one share", () => {
    // A bill carries one row per MEAL, and several of them belong to one event.
    const perMeal = [
      { eventId: "home", amount: 50000 },
      { eventId: "home", amount: 70000 },
      { eventId: "venue", amount: 480000 }
    ]
    const shares = billedSharesOf(600000, perMeal)
    expect(shares.get("home")).toBe(120000)
    expect(shares.size).toBe(2)
  })

  it("ignores rows not tied to an event", () => {
    const mixed = [
      { eventId: "home", amount: 120000 },
      { eventId: null, amount: 5000 }
    ]
    const shares = billedSharesOf(125000, mixed)
    expect(shares.get("home")).toBe(125000)
    expect(shares.size).toBe(1)
  })

  it("returns nothing to apportion when the bill has no event rows", () => {
    // Callers fall back to the event's own quote.
    expect(billedSharesOf(50000, []).size).toBe(0)
    expect(billedSharesOf(50000, [{ eventId: "a", amount: 0 }]).size).toBe(0)
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: { bill: { findMany: vi.fn() } },
}))

import { prisma } from "@/lib/prisma"
import { billingByEvent } from "./eventBilling"

// The rule this file exists for: a discount lives on the BILL, but the event history and
// the event page compare payments per EVENT. Without pushing the discount down, a
// customer who paid his discounted total in full stayed stuck on "Partial".
describe("billingByEvent", () => {
  beforeEach(() => vi.clearAllMocks())

  it("splits a discount across the events a bill covers", async () => {
    // One booking, two venues: home functions and the wedding hall.
    vi.mocked(prisma.bill.findMany).mockResolvedValue([{
      id: "bill-1", billNumber: "BILL-2026-AAAA", billDate: new Date("2026-11-25"),
      subtotal: 600000, discountAmount: 60000, totalAmount: 540000,
      items: [
        { eventId: "home", amount: 120000 },
        { eventId: "venue", amount: 480000 },
      ],
    }] as any)

    const out = await billingByEvent(["home", "venue"], "owner-1")

    expect(out.get("home")).toEqual({
      billId: "bill-1", billNumber: "BILL-2026-AAAA",
      amount: 108000, itemsTotal: 120000, discountAmount: 12000, taxAmount: 0,
    })
    expect(out.get("venue")!.amount).toBe(432000)
    // The parts describe the whole: the shares add back up to the bill.
    expect(out.get("home")!.amount + out.get("venue")!.amount).toBe(540000)
  })

  it("splits tax the same way", async () => {
    vi.mocked(prisma.bill.findMany).mockResolvedValue([{
      id: "bill-1", billNumber: "BILL-2026-AAAA", billDate: new Date("2026-11-25"),
      subtotal: 100000, discountAmount: 0, totalAmount: 105000,   // 5% GST
      items: [{ eventId: "home", amount: 100000 }],
    }] as any)

    const out = await billingByEvent(["home"], "owner-1")

    expect(out.get("home")!.taxAmount).toBe(5000)
    expect(out.get("home")!.amount).toBe(105000)
  })

  it("uses the most recent bill when an event has been reissued", async () => {
    // Reissuing a corrected invoice is normal; the corrected one is the one that counts.
    vi.mocked(prisma.bill.findMany).mockResolvedValue([
      {
        id: "bill-new", billNumber: "BILL-2026-BBBB", billDate: new Date("2026-12-01"),
        subtotal: 100000, discountAmount: 20000, totalAmount: 80000,
        items: [{ eventId: "home", amount: 100000 }],
      },
      {
        id: "bill-old", billNumber: "BILL-2026-AAAA", billDate: new Date("2026-11-01"),
        subtotal: 100000, discountAmount: 0, totalAmount: 100000,
        items: [{ eventId: "home", amount: 100000 }],
      },
    ] as any)

    const out = await billingByEvent(["home"], "owner-1")

    expect(out.get("home")!.billNumber).toBe("BILL-2026-BBBB")
    expect(out.get("home")!.amount).toBe(80000)
  })

  it("returns nothing for an event with no bill, and asks the database nothing when given none", async () => {
    expect((await billingByEvent([], "owner-1")).size).toBe(0)
    expect(prisma.bill.findMany).not.toHaveBeenCalled()

    vi.mocked(prisma.bill.findMany).mockResolvedValue([] as any)
    expect((await billingByEvent(["home"], "owner-1")).size).toBe(0)
  })
})

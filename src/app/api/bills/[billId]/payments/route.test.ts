import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }))

const tx = {
  advancePayment: { createMany: vi.fn(), groupBy: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
  event: { update: vi.fn() },
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    bill: { findFirst: vi.fn() },
    advancePayment: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { POST, DELETE } from "./route"

const ctx = { params: { billId: "bill-1" } }
const post = (body: any) =>
  POST(new NextRequest("http://localhost/api/bills/bill-1/payments", {
    method: "POST", body: JSON.stringify(body),
  }), ctx as any)

// This route writes money. Every guard here exists because the alternative is a payment
// landing on the wrong event, on another business's event, or on nothing at all.
describe("POST /api/bills/[billId]/payments", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_owner" } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "owner-1", role: "owner", ownerId: null,
    } as any)
    // A bill covering two events — the home functions and the wedding venue.
    vi.mocked(prisma.bill.findFirst).mockResolvedValue({
      items: [{ eventId: "home" }, { eventId: "venue" }],
    } as any)
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(tx))
    tx.advancePayment.groupBy.mockResolvedValue([])
    tx.advancePayment.findMany.mockResolvedValue([])
  })

  it("writes one row per event, sharing a groupId", async () => {
    // Stored per event so Event.advancePayment stays a straight sum; tied by groupId so
    // the payment can still be read and removed as the one thing the operator entered.
    const res = await post({
      amount: 300000, paidDate: "2026-11-05", notes: "cash",
      allocations: [{ eventId: "home", amount: 120000 }, { eventId: "venue", amount: 180000 }],
    })

    expect(res.status).toBe(200)
    const rows = tx.advancePayment.createMany.mock.calls[0][0].data
    expect(rows).toHaveLength(2)
    expect(rows[0].groupId).toBe(rows[1].groupId)
    expect(rows.map((r: any) => r.amount)).toEqual([120000, 180000])
    expect(rows.every((r: any) => r.billId === "bill-1")).toBe(true)
  })

  it("refuses a split that does not add up to the payment", async () => {
    // Money that is neither allocated nor rejected is money the totals quietly lose.
    const res = await post({
      amount: 300000, paidDate: "2026-11-05",
      allocations: [{ eventId: "home", amount: 120000 }],
    })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain("120000")
    expect(tx.advancePayment.createMany).not.toHaveBeenCalled()
  })

  it("refuses an allocation to an event this bill does not cover", async () => {
    // Otherwise a crafted request moves money onto an unrelated booking.
    const res = await post({
      amount: 50000, paidDate: "2026-11-05",
      allocations: [{ eventId: "someone-elses-event", amount: 50000 }],
    })

    expect(res.status).toBe(400)
    expect(tx.advancePayment.createMany).not.toHaveBeenCalled()
  })

  it("404s a bill that is not this business's", async () => {
    vi.mocked(prisma.bill.findFirst).mockResolvedValue(null)

    const res = await post({
      amount: 50000, paidDate: "2026-11-05",
      allocations: [{ eventId: "home", amount: 50000 }],
    })

    expect(res.status).toBe(404)
  })

  it("rejects a bad date instead of passing it to the database", async () => {
    const res = await post({
      amount: 50000, paidDate: "not a date",
      allocations: [{ eventId: "home", amount: 50000 }],
    })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain("date")
  })

  it("rejects a non-positive amount", async () => {
    for (const amount of [0, -5000]) {
      const res = await post({
        amount, paidDate: "2026-11-05",
        allocations: [{ eventId: "home", amount }],
      })
      expect(res.status).toBe(400)
    }
  })

  it("collapses two entries for the same event into one row", async () => {
    const res = await post({
      amount: 100000, paidDate: "2026-11-05",
      allocations: [{ eventId: "home", amount: 60000 }, { eventId: "home", amount: 40000 }],
    })

    expect(res.status).toBe(200)
    const rows = tx.advancePayment.createMany.mock.calls[0][0].data
    expect(rows).toHaveLength(1)
    expect(rows[0].amount).toBe(100000)
  })

  it("re-sums every event it touched, in the same transaction that wrote the rows", async () => {
    // CLAUDE.md: the cached Event.advancePayment may only change alongside the rows it
    // summarises, or the cache and the ledger drift apart.
    tx.advancePayment.groupBy.mockResolvedValue([
      { eventId: "home", _sum: { amount: 120000 } },
      { eventId: "venue", _sum: { amount: 180000 } },
    ])

    await post({
      amount: 300000, paidDate: "2026-11-05",
      allocations: [{ eventId: "home", amount: 120000 }, { eventId: "venue", amount: 180000 }],
    })

    expect(tx.event.update).toHaveBeenCalledWith({ where: { id: "home" }, data: { advancePayment: 120000 } })
    expect(tx.event.update).toHaveBeenCalledWith({ where: { id: "venue" }, data: { advancePayment: 180000 } })
  })
})

describe("DELETE /api/bills/[billId]/payments", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_owner" } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "owner-1", role: "owner", ownerId: null,
    } as any)
    vi.mocked(prisma.bill.findFirst).mockResolvedValue({
      items: [{ eventId: "home" }, { eventId: "venue" }],
    } as any)
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(tx))
    tx.advancePayment.groupBy.mockResolvedValue([])
  })

  const del = (qs: string) =>
    DELETE(new NextRequest(`http://localhost/api/bills/bill-1/payments?${qs}`, { method: "DELETE" }), ctx as any)

  it("removes every row of the payment, not just one leg of the split", async () => {
    // Deleting half a two-event payment leaves a payment that never happened as far as
    // one of the events is concerned.
    vi.mocked(prisma.advancePayment.findMany).mockResolvedValue([
      { id: "p1", eventId: "home" }, { id: "p2", eventId: "venue" },
    ] as any)

    const res = await del("groupId=pay_123")

    expect(res.status).toBe(200)
    expect(tx.advancePayment.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["p1", "p2"] } } })
  })

  it("resets an event to zero when its last payment is removed", async () => {
    // groupBy returns no row for an event with nothing left, so a lookup that skipped
    // missing rows would leave the old total cached forever.
    vi.mocked(prisma.advancePayment.findMany).mockResolvedValue([
      { id: "p1", eventId: "home" },
    ] as any)
    tx.advancePayment.groupBy.mockResolvedValue([])

    await del("groupId=pay_123")

    expect(tx.event.update).toHaveBeenCalledWith({ where: { id: "home" }, data: { advancePayment: 0 } })
  })

  it("only ever looks at rows belonging to this bill", async () => {
    // A guessed groupId must not reach another business's payments.
    vi.mocked(prisma.advancePayment.findMany).mockResolvedValue([{ id: "p1", eventId: "home" }] as any)

    await del("groupId=pay_123")

    expect(prisma.advancePayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ billId: "bill-1" }) })
    )
  })

  it("404s a bill that is not this business's", async () => {
    vi.mocked(prisma.bill.findFirst).mockResolvedValue(null)
    expect((await del("groupId=pay_123")).status).toBe(404)
  })
})

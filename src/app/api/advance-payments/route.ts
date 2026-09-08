import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateBody } from "@/lib/validate"  // CHANGED: request body validation
import { advancePaymentSchema } from "@/lib/schemas"
import { withAuth } from "@/lib/withAuth" // CHANGED: replaces the repeated auth/user-lookup/try-catch preamble

// CHANGED: every handler is { ownerOnly: true }. Only DELETE used to check for staff;
// GET and POST were open, and an old comment claimed staff were meant to add advances.
// The UI says otherwise — the advance column is hidden from staff in the event-history
// table AND stripped from its CSV, and the whole advance section is hidden on the event
// detail page. So staff already had no way to see or add an advance; the API was simply
// the one exit path where the rule was not enforced, reachable by typing the URL.
// Confirmed with the owner 2026-09-08: staff should not access advance payments at all.

export const GET = withAuth(async (req: NextRequest, { effectiveUserId }) => {
    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get("eventId")

    if (!eventId) {
      return NextResponse.json({ success: false, error: "eventId is required" }, { status: 400 })
    }

    // CHANGED: don't return another business's advance payments
    const event = await prisma.event.findFirst({ where: { id: eventId, userId: effectiveUserId }, select: { id: true } })
    if (!event) {
      return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 })
    }

    const payments = await prisma.advancePayment.findMany({
      where: { eventId },
      orderBy: { paidDate: "asc" }
    })

    return NextResponse.json({ success: true, data: payments })
}, { ownerOnly: true })

export const POST = withAuth(async (req: NextRequest, { effectiveUserId }) => {
    const rawBody = await req.json()
    // CHANGED: schema validation (log-only until VALIDATE_ENFORCE=true) — see lib/validate.ts
    const check = validateBody(advancePaymentSchema, rawBody, "POST /api/advance-payments")
    if (!check.ok) return check.response
    const { eventId, amount, paidDate, notes } = check.data as any

    if (!eventId || !amount || !paidDate) {
      return NextResponse.json({ success: false, error: "eventId, amount, and paidDate are required" }, { status: 400 })
    }

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ success: false, error: "Amount must be greater than 0" }, { status: 400 })
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, userId: effectiveUserId}
    })
    if (!event) {
      return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.advancePayment.create({
        data: {
          eventId,
          amount: parsedAmount,
          paidDate: new Date(paidDate),
          notes: notes?.trim() || null
        }
      })

      const allPayments = await tx.advancePayment.findMany({
        where: { eventId },
        select: { amount: true }
      })
      const newTotal = allPayments.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0)

      await tx.event.update({
        where: { id: eventId },
        data: { advancePayment: newTotal }
      })

      return { payment, newTotal }
    })

    return NextResponse.json({ success: true, data: result.payment, advanceTotal: result.newTotal })
}, { ownerOnly: true })

export const DELETE = withAuth(async (req: NextRequest, { effectiveUserId }) => {
    const { searchParams } = new URL(req.url)
    const paymentId = searchParams.get("id")

    if (!paymentId) {
      return NextResponse.json({ success: false, error: "Payment ID is required" }, { status: 400 })
    }

    // Owner-only, like the other two handlers — see the note at the top of the file.
    const payment = await prisma.advancePayment.findUnique({
      where: { id: paymentId },
      select: { id: true, eventId: true, event: { select: { userId: true } } }
    })
    if (!payment) {
      return NextResponse.json({ success: false, error: "Payment not found" }, { status: 404 })
    }
    if (payment.event.userId !== effectiveUserId) {
      return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 })
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.advancePayment.delete({ where: { id: paymentId } })

      const remaining = await tx.advancePayment.findMany({
        where: { eventId: payment.eventId },
        select: { amount: true }
      })
      const newTotal = remaining.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0)

      await tx.event.update({
        where: { id: payment.eventId },
        data: { advancePayment: newTotal }
      })

      return { newTotal }
    })

    return NextResponse.json({ success: true, message: "Payment deleted", advanceTotal: result.newTotal })
}, { ownerOnly: true })

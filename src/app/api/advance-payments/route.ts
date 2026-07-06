import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { getEffectiveUserId } from "@/lib/getEffectiveUserId"

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get("eventId")

    if (!eventId) {
      return NextResponse.json({ success: false, error: "eventId is required" }, { status: 400 })
    }

    const payments = await prisma.advancePayment.findMany({
      where: { eventId },
      orderBy: { paidDate: "asc" }
    })

    return NextResponse.json({ success: true, data: payments })
  } catch (error) {
    console.error("Error fetching advance payments:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch payments" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const { eventId, amount, paidDate, notes } = await req.json()

    if (!eventId || !amount || !paidDate) {
      return NextResponse.json({ success: false, error: "eventId, amount, and paidDate are required" }, { status: 400 })
    }

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ success: false, error: "Amount must be greater than 0" }, { status: 400 })
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, userId: getEffectiveUserId(dbUser)}
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
  } catch (error) {
    console.error("Error creating advance payment:", error)
    return NextResponse.json({ success: false, error: "Failed to create payment" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const paymentId = searchParams.get("id")

    if (!paymentId) {
      return NextResponse.json({ success: false, error: "Payment ID is required" }, { status: 400 })
    }

    const payment = await prisma.advancePayment.findUnique({
      where: { id: paymentId },
      select: { id: true, eventId: true, event: { select: { userId: true } } }
    })
    if (!payment) {
      return NextResponse.json({ success: false, error: "Payment not found" }, { status: 404 })
    }
    if (payment.event.userId !== dbUser.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 })
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
  } catch (error) {
    console.error("Error deleting advance payment:", error)
    return NextResponse.json({ success: false, error: "Failed to delete payment" }, { status: 500 })
  }
}
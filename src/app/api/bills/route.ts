import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateBody } from "@/lib/validate"  // CHANGED: request body validation
import { billSchema } from "@/lib/schemas"
import { withAuth } from "@/lib/withAuth" // CHANGED: replaces the repeated auth/user-lookup/403/try-catch preamble

function generateBillNumber() {
  const year = new Date().getFullYear()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `BILL-${year}-${random}`
}

// CHANGED: withAuth resolves the session, loads the user, derives effectiveUserId
// and — via { ownerOnly: true } — returns the 403 that each handler used to write
// by hand. Staff access is unchanged; it is now declared rather than remembered.
export const GET = withAuth(async (req: NextRequest, { effectiveUserId }) => {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const phoneNumber = searchParams.get("phoneNumber")

    const bills = await prisma.bill.findMany({
      where: {
        userId: effectiveUserId,
        ...(status && status !== "all" && { status }),
        ...(phoneNumber && { phoneNumber: { contains: phoneNumber } })
      },
      include: {
        items: true
      },
      orderBy: { billDate: "desc" }
    })

    // For each bill, calculate advance total from linked events
    const billsWithAdvance = await Promise.all(bills.map(async (bill) => {
      // Get unique event IDs from bill items
      const eventIds = Array.from(new Set(
  bill.items
    .map(item => item.eventId)
    .filter((id): id is string => id !== null && id !== undefined)
))

      let advanceTotal = 0

      if (eventIds.length > 0) {
        // Sum advance payments from all linked events
        const events = await prisma.event.findMany({
          where: { id: { in: eventIds } },
          select: { advancePayment: true }
        })
        advanceTotal = events.reduce((sum, e) => sum + (e.advancePayment || 0), 0)
      }

      return {
        ...bill,
        advanceTotal
      }
    }))

    return NextResponse.json({ success: true, data: billsWithAdvance })
}, { ownerOnly: true })

export const POST = withAuth(async (req: NextRequest, { effectiveUserId }) => {
    const rawBody = await req.json()
    // CHANGED: schema validation (log-only until VALIDATE_ENFORCE=true). This is the
    // route where an unvalidated quantity/rate becomes NaN and is saved as the bill total.
    const check = validateBody(billSchema, rawBody, "POST /api/bills")
    if (!check.ok) return check.response
    const body = check.data as any
    const {
      customerName,
      phoneNumber,
      address,
      clientGstNo,
      items,
      discountType,
      discountValue,
      sgst,
      cgst,
      notes
    } = body

    if (!customerName || !phoneNumber || !items || items.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: "Customer name, phone number, and at least one item are required" 
      }, { status: 400 })
    }

    const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.rate), 0)
    
    let discountAmount = 0
    if (discountType === "percentage") {
      discountAmount = (subtotal * discountValue) / 100
    } else if (discountType === "fixed") {
      discountAmount = discountValue
    }

    const afterDiscount = subtotal - discountAmount
    const sgstAmount = (afterDiscount * (sgst || 0)) / 100
    const cgstAmount = (afterDiscount * (cgst || 0)) / 100
    const totalAmount = afterDiscount + sgstAmount + cgstAmount

    const bill = await prisma.bill.create({
      data: {
        billNumber: generateBillNumber(),
        customerName,
        phoneNumber,
        address,
        clientGstNo,
        subtotal,
        discountType,
        discountValue: discountValue || 0,
        discountAmount,
        sgst: sgst || 0,
        cgst: cgst || 0,
        totalAmount,
        notes,
        userId: effectiveUserId,
        items: {
          create: items.map((item: any) => ({
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.quantity * item.rate,
            eventId: item.eventId || null
          }))
        }
      },
      include: {
        items: true
      }
    })

    return NextResponse.json({ success: true, data: bill })
}, { ownerOnly: true })

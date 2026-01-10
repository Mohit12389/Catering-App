import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

// Generate unique bill number
function generateBillNumber() {
  const year = new Date().getFullYear()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `BILL-${year}-${random}`
}

// GET - Fetch all bills
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({ 
      where: { clerkId: userId },
      select: { id: true }
    })
    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const phoneNumber = searchParams.get("phoneNumber")

    const bills = await prisma.bill.findMany({
      where: {
        userId: dbUser.id,
        ...(status && status !== "all" && { status }),
        ...(phoneNumber && { phoneNumber: { contains: phoneNumber } })
      },
      include: {
        items: true
      },
      orderBy: { billDate: "desc" }
    })

    return NextResponse.json({ success: true, data: bills })
  } catch (error) {
    console.error("Error fetching bills:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch bills" }, { status: 500 })
  }
}

// POST - Create new bill
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({ 
      where: { clerkId: userId },
      select: { id: true }
    })
    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const body = await req.json()
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

    // Calculate amounts
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
        userId: dbUser.id,
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
  } catch (error) {
    console.error("Error creating bill:", error)
    return NextResponse.json({ success: false, error: "Failed to create bill" }, { status: 500 })
  }
}

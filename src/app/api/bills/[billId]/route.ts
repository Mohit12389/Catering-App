import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

// GET - Fetch single bill
export async function GET(
  req: NextRequest,
  { params }: { params: { billId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const bill = await prisma.bill.findUnique({
      where: { id: params.billId },
      include: {
        items: true
      }
    })

    if (!bill) {
      return NextResponse.json({ success: false, error: "Bill not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: bill })
  } catch (error) {
    console.error("Error fetching bill:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch bill" }, { status: 500 })
  }
}

// PUT - Update bill (status, payment, or full edit)
export async function PUT(
  req: NextRequest,
  { params }: { params: { billId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { 
      status, 
      paidAmount, 
      updateItems,
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

    const bill = await prisma.bill.findUnique({
      where: { id: params.billId }
    })

    if (!bill) {
      return NextResponse.json({ success: false, error: "Bill not found" }, { status: 404 })
    }

    // Full bill update with items
    if (updateItems && items) {
      // Calculate amounts
      const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.rate), 0)
      
      let discountAmount = 0
      if (discountType === "percentage") {
        discountAmount = (subtotal * (discountValue || 0)) / 100
      } else if (discountType === "fixed") {
        discountAmount = discountValue || 0
      }

      const afterDiscount = subtotal - discountAmount
      const sgstAmount = (afterDiscount * (sgst || 0)) / 100
      const cgstAmount = (afterDiscount * (cgst || 0)) / 100
      const totalAmount = afterDiscount + sgstAmount + cgstAmount

      // Delete existing items and create new ones
      await prisma.billItem.deleteMany({
        where: { billId: params.billId }
      })

      const updatedBill = await prisma.bill.update({
        where: { id: params.billId },
        data: {
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

      return NextResponse.json({ success: true, data: updatedBill })
    }

    // Simple status/payment update
    let newStatus = status
    if (paidAmount !== undefined) {
      const newPaidAmount = paidAmount
      if (newPaidAmount >= bill.totalAmount) {
        newStatus = "paid"
      } else if (newPaidAmount > 0) {
        newStatus = "partial"
      } else {
        newStatus = "unpaid"
      }
    }

    const updatedBill = await prisma.bill.update({
      where: { id: params.billId },
      data: {
        ...(status && { status: newStatus }),
        ...(paidAmount !== undefined && { paidAmount, status: newStatus })
      },
      include: {
        items: true
      }
    })

    return NextResponse.json({ success: true, data: updatedBill })
  } catch (error) {
    console.error("Error updating bill:", error)
    return NextResponse.json({ success: false, error: "Failed to update bill" }, { status: 500 })
  }
}

// DELETE - Delete bill
export async function DELETE(
  req: NextRequest,
  { params }: { params: { billId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    await prisma.bill.delete({
      where: { id: params.billId }
    })

    return NextResponse.json({ success: true, message: "Bill deleted" })
  } catch (error) {
    console.error("Error deleting bill:", error)
    return NextResponse.json({ success: false, error: "Failed to delete bill" }, { status: 500 })
  }
}

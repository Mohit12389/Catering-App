import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

// POST - Mark a category as paid for an event (or multiple events)
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
      eventIds, 
      ingredientCategoryId, 
      categoryName, 
      notes 
    }: {
      eventIds: string[]
      ingredientCategoryId: string
      categoryName: string
      notes?: string
    } = body

    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: "At least one eventId is required"
      }, { status: 400 })
    }

    if (!ingredientCategoryId) {
      return NextResponse.json({
        success: false,
        error: "ingredientCategoryId is required"
      }, { status: 400 })
    }

    const results = []

    for (const eventId of eventIds) {
      // Get event ingredients for this category
      const eventIngredients = await prisma.eventIngredient.findMany({
        where: {
          eventId,
          status: { not: "removed" },
          ingredient: {
            categoryId: ingredientCategoryId
          }
        },
        include: {
          ingredient: {
            select: {
              ratePerUnit: true
            }
          }
        }
      })

      const amount = eventIngredients.reduce((sum: number, ei: { priceAtEvent: number | null; quantity: number; ingredient: { ratePerUnit: number } }) => {
        const price = ei.priceAtEvent ?? ei.ingredient.ratePerUnit ?? 0
        return sum + (ei.quantity * price)
      }, 0)

      // Upsert payment record
      const payment = await prisma.categoryPayment.upsert({
        where: {
          eventId_ingredientCategoryId: {
            eventId,
            ingredientCategoryId
          }
        },
        update: {
          amount,
          paidAt: new Date(),
          notes: notes || null
        },
        create: {
          eventId,
          ingredientCategoryId,
          categoryName: categoryName || "",
          amount,
          paidAt: new Date(),
          notes: notes || null,
          userId: dbUser.id
        }
      })

      results.push(payment)
    }

    return NextResponse.json({
      success: true,
      data: results,
      message: `Payment marked for ${results.length} event(s)`
    })
  } catch (error) {
    console.error("Error marking payment:", error)
    return NextResponse.json({ success: false, error: "Failed to mark payment" }, { status: 500 })
  }
}

// DELETE - Unmark a payment (remove payment record)
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const paymentId = searchParams.get("paymentId")
    const eventId = searchParams.get("eventId")
    const ingredientCategoryId = searchParams.get("ingredientCategoryId")

    if (paymentId) {
      await prisma.categoryPayment.delete({
        where: { id: paymentId }
      })
    } else if (eventId && ingredientCategoryId) {
      await prisma.categoryPayment.delete({
        where: {
          eventId_ingredientCategoryId: {
            eventId,
            ingredientCategoryId
          }
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        error: "paymentId or (eventId + ingredientCategoryId) required"
      }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: "Payment record removed" })
  } catch (error) {
    console.error("Error removing payment:", error)
    return NextResponse.json({ success: false, error: "Failed to remove payment" }, { status: 500 })
  }
}
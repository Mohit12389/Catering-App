import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

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
    const phoneNumber = searchParams.get("phoneNumber")

    if (!phoneNumber) {
      return NextResponse.json({ success: false, error: "Phone number required" }, { status: 400 })
    }

    const events = await prisma.event.findMany({
      where: {
        userId: dbUser.id,
        phoneNumber: { contains: phoneNumber }
      },
      select: {
        id: true,
        eventId: true,
        organizerName: true,
        phoneNumber: true,
        location: true,
        functionDate: true,
        functionTime: true,
        guestCount: true,
        perPlatePrice: true,
        totalAmount: true,
        advancePayment: true,
        status: true,
        // Include advance payment installments
        advancePayments: {
          select: {
            id: true,
            amount: true,
            paidDate: true,
            notes: true
          },
          orderBy: { paidDate: "asc" }
        }
      },
      orderBy: { functionDate: "desc" }
    })

    const eventsWithCost = await Promise.all(events.map(async (event) => {
      const categorySettings = await prisma.eventCategorySetting.findMany({
        where: { eventId: event.id },
        select: {
          ingredientCategoryId: true,
          boughtBy: true
        }
      })

      const categoryBoughtByMap: Record<string, string> = {}
      for (const setting of categorySettings) {
        categoryBoughtByMap[setting.ingredientCategoryId] = setting.boughtBy
      }

      // FIX: Include priceAtEvent so we use the correct locked price
      const eventIngredients = await prisma.eventIngredient.findMany({
        where: { eventId: event.id },
        select: {
          quantity: true,
          priceAtEvent: true,
          ingredient: {
            select: {
              categoryId: true,
              ratePerUnit: true
            }
          }
        }
      })

      let catererCost = 0
      let clientCost = 0

      for (const ei of eventIngredients) {
        const categoryId = ei.ingredient?.categoryId
        // FIX: Use priceAtEvent if available, fallback to ratePerUnit
        const unitPrice = ei.priceAtEvent ?? ei.ingredient?.ratePerUnit ?? 0
        const itemCost = ei.quantity * unitPrice

        const boughtBy = categoryId ? (categoryBoughtByMap[categoryId] || "caterer") : "caterer"

        if (boughtBy === "client") {
          clientCost += itemCost
        } else {
          catererCost += itemCost
        }
      }

      return {
        ...event,
        catererCost: Math.round(catererCost * 100) / 100,
        clientCost: Math.round(clientCost * 100) / 100
      }
    }))

    return NextResponse.json({ success: true, data: eventsWithCost })
  } catch (error) {
    console.error("Error fetching events:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch events" }, { status: 500 })
  }
}
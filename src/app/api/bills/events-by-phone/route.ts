import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

// GET - Fetch events by phone number with ingredient costs (caterer & client)
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

    // Find events that contain this phone number
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
        status: true
      },
      orderBy: { functionDate: "desc" }
    })

    // For each event, calculate ingredient costs separately
    const eventsWithCost = await Promise.all(events.map(async (event) => {
      // Get category settings (boughtBy is per ingredient CATEGORY)
      const categorySettings = await prisma.eventCategorySetting.findMany({
        where: { eventId: event.id },
        select: {
          ingredientCategoryId: true,
          boughtBy: true
        }
      })

      // Build map of categoryId -> boughtBy
      const categoryBoughtByMap: Record<string, string> = {}
      for (const setting of categorySettings) {
        categoryBoughtByMap[setting.ingredientCategoryId] = setting.boughtBy
      }

      // Get event ingredients with quantities and their category
      const eventIngredients = await prisma.eventIngredient.findMany({
        where: { eventId: event.id },
        select: {
          quantity: true,
          ingredient: {
            select: {
              categoryId: true,
              ratePerUnit: true
            }
          }
        }
      })

      // Calculate costs based on category's boughtBy setting
      let catererCost = 0
      let clientCost = 0

      for (const ei of eventIngredients) {
        const categoryId = ei.ingredient?.categoryId
        const unitPrice = ei.ingredient?.ratePerUnit || 0
        const itemCost = ei.quantity * unitPrice
        
        // Get boughtBy from category setting (default to "caterer")
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
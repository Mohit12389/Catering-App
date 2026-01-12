import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

// GET - Fetch events by phone number with ingredient cost
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
        status: true,
        // Include event ingredients for cost calculation
        eventIngredients: {
          select: {
            quantity: true,
            ingredient: {
              select: {
                ratePerUnit: true
              }
            }
          }
        }
      },
      orderBy: { functionDate: "desc" }
    })

    // Calculate ingredient cost for each event
    const eventsWithCost = events.map(event => {
      // Calculate total ingredient cost
      let ingredientCost = 0
      for (const ei of event.eventIngredients) {
        const unitPrice = ei.ingredient?.ratePerUnit || 0
        ingredientCost += ei.quantity * unitPrice
      }

      // Return event data with ingredient cost (exclude raw eventIngredients)
      return {
        id: event.id,
        eventId: event.eventId,
        organizerName: event.organizerName,
        phoneNumber: event.phoneNumber,
        location: event.location,
        functionDate: event.functionDate,
        functionTime: event.functionTime,
        guestCount: event.guestCount,
        perPlatePrice: event.perPlatePrice,
        totalAmount: event.totalAmount,
        status: event.status,
        ingredientCost: Math.round(ingredientCost * 100) / 100
      }
    })

    return NextResponse.json({ success: true, data: eventsWithCost })
  } catch (error) {
    console.error("Error fetching events:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch events" }, { status: 500 })
  }
}
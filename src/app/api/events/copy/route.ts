import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { generateEventId } from "@/lib/utils"
import { getEffectiveUserId } from "@/lib/getEffectiveUserId"

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({ 
      where: { clerkId: userId },
      select: { id: true, role: true, ownerId: true }
    })
    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const body = await req.json()
    const {
      sourceEventId,
      organizerName,
      phoneNumber,
      location,
      functionDate,
      functionTime,
      guestCount,
      perPlatePrice
    } = body

    if (!sourceEventId || !organizerName || !phoneNumber || !functionDate) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
    }

    // Fetch source event with items and ingredients
    const sourceEvent = await prisma.event.findUnique({
      where: { id: sourceEventId },
      include: {
        eventItems: true,
        eventIngredients: {
          include: {
            ingredient: true
          }
        },
        eventCategorySettings: true
      }
    })

    if (!sourceEvent) {
      return NextResponse.json({ success: false, error: "Source event not found" }, { status: 404 })
    }

    // Calculate total amount
    const totalAmount = (guestCount || sourceEvent.guestCount) * (perPlatePrice || 0)

    // Create new event
    const newEvent = await prisma.event.create({
      data: {
        eventId: generateEventId(),
        organizerName,
        phoneNumber,
        location: location || sourceEvent.location,
        bookingDate: new Date(),
        functionDate: new Date(functionDate),
        functionTime: functionTime || sourceEvent.functionTime,
        menuCreationDate: new Date(),
        guestCount: guestCount || sourceEvent.guestCount,
        perPlatePrice: perPlatePrice || 0,
        totalAmount,
        advancePayment: 0,
        status: "active",
        userId: getEffectiveUserId(dbUser),
        // Copy menu items
        eventItems: {
          create: sourceEvent.eventItems.map(ei => ({
            itemId: ei.itemId
          }))
        },
        // Copy ingredients with same quantities
        eventIngredients: {
          create: sourceEvent.eventIngredients.map(ei => ({
            ingredientId: ei.ingredientId,
            quantity: ei.quantity,
            priceAtEvent: ei.ingredient.ratePerUnit
          }))
        },
        // Copy category settings
        eventCategorySettings: {
          create: sourceEvent.eventCategorySettings.map(cs => ({
            ingredientCategoryId: cs.ingredientCategoryId,
            boughtBy: cs.boughtBy
          }))
        }
      },
      select: {
        id: true,
        eventId: true,
        organizerName: true
      }
    })

    return NextResponse.json({ success: true, data: newEvent }, { status: 201 })
  } catch (error) {
    console.error("Error copying event:", error)
    return NextResponse.json({ success: false, error: "Failed to copy event" }, { status: 500 })
  }
}

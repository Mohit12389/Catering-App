import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { ingredientId, newPrice, startDate, endDate } = await req.json()

    if (!ingredientId || newPrice === undefined) {
      return NextResponse.json({ success: false, error: "ingredientId and newPrice are required" }, { status: 400 })
    }

    // Update the ingredient's default price
    await prisma.ingredient.update({
      where: { id: ingredientId },
      data: { ratePerUnit: newPrice }
    })

    let updatedCount = 0

    // If date range is provided, update event ingredients for ACTIVE events with menuCreationDate in range
    if (startDate && endDate) {
      // Find all ACTIVE events where menuCreationDate is in the date range
      const events = await prisma.event.findMany({
        where: {
          status: 'active', // Only active events, not completed
          menuCreationDate: {
            gte: new Date(startDate),
            lte: new Date(endDate + 'T23:59:59')
          }
        },
        select: { id: true }
      })

      const eventIds = events.map(e => e.id)

      // Update priceAtEvent for all matching event ingredients
      const result = await prisma.eventIngredient.updateMany({
        where: {
          ingredientId,
          eventId: { in: eventIds }
        },
        data: {
          priceAtEvent: newPrice
        }
      })
      
      updatedCount = result.count

      // Also save to price history for record
      await prisma.ingredientPriceHistory.create({
        data: {
          ingredientId,
          price: newPrice,
          startDate: new Date(startDate),
          endDate: new Date(endDate)
        }
      })
    }

    return NextResponse.json({ 
      success: true, 
      message: startDate && endDate 
        ? `Price updated. ${updatedCount} event ingredients affected.`
        : "Default price updated"
    })
  } catch (error) {
    console.error("Error updating price:", error)
    return NextResponse.json({ success: false, error: "Failed to update price" }, { status: 500 })
  }
}

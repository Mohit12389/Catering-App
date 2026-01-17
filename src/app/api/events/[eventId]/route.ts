import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const event = await prisma.event.findUnique({
      where: { id: params.eventId },
      select: {
        id: true,
        eventId: true,
        organizerName: true,
        phoneNumber: true,
        location: true,
        bookingDate: true,
        functionDate: true,
        functionTime: true,
        menuCreationDate: true,
        guestCount: true,
        perPlatePrice: true,
        totalAmount: true,
        advancePayment: true,
        status: true,
        notes: true,
        eventItems: {
          select: {
            id: true,
            itemId: true,
            item: {
              select: {
                id: true,
                name: true,
                category: { select: { id: true, name: true } }
              }
            }
          }
        },
        eventIngredients: {
          select: {
            id: true,
            ingredientId: true,
            quantity: true,
            priceAtEvent: true,
            status: true,
            ingredient: {
              select: {
                id: true,
                name: true,
                unit: true,
                ratePerUnit: true,
                category: { select: { id: true, name: true } }
              }
            }
          }
        },
        eventCategorySettings: {
          select: {
            id: true,
            ingredientCategoryId: true,
            boughtBy: true
          }
        }
      }
    })

    if (!event) {
      return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: event })
  } catch (error) {
    console.error("Error fetching event:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch event" }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { status, addItems, removeItems, ...updateData } = body

    const updatePayload: any = {}
    if (status) updatePayload.status = status
    if (updateData.organizerName) updatePayload.organizerName = updateData.organizerName
    if (updateData.phoneNumber) updatePayload.phoneNumber = updateData.phoneNumber
    if (updateData.location) updatePayload.location = updateData.location
    if (updateData.functionDate) updatePayload.functionDate = new Date(updateData.functionDate)
    if (updateData.functionTime) updatePayload.functionTime = updateData.functionTime
    if (updateData.guestCount) updatePayload.guestCount = parseInt(updateData.guestCount)
    if (updateData.notes !== undefined) updatePayload.notes = updateData.notes

    // Update event basic info
    if (Object.keys(updatePayload).length > 0) {
      await prisma.event.update({
        where: { id: params.eventId },
        data: updatePayload
      })
    }

    // Add new items
    if (addItems && Array.isArray(addItems) && addItems.length > 0) {
      const items = await prisma.item.findMany({
        where: { id: { in: addItems } },
        select: { id: true, itemIngredients: { select: { ingredientId: true } } }
      })

      await prisma.eventItem.createMany({
        data: addItems.map((itemId: string) => ({
          eventId: params.eventId,
          itemId
        })),
        skipDuplicates: true
      })

      const existingIngredients = await prisma.eventIngredient.findMany({
        where: { eventId: params.eventId },
        select: { ingredientId: true }
      })
      const existingIngredientIds = new Set(existingIngredients.map(e => e.ingredientId))

      const newIngredientIds = new Set<string>()
      items.forEach(item => {
        item.itemIngredients.forEach(ii => {
          if (!existingIngredientIds.has(ii.ingredientId)) {
            newIngredientIds.add(ii.ingredientId)
          }
        })
      })

      // Get current prices for new ingredients
      if (newIngredientIds.size > 0) {
        const ingredientPrices = await prisma.ingredient.findMany({
          where: { id: { in: Array.from(newIngredientIds) } },
          select: { id: true, ratePerUnit: true }
        })
        const priceMap = new Map(ingredientPrices.map(i => [i.id, i.ratePerUnit]))

        // Create new event ingredients WITH priceAtEvent from current ratePerUnit
        await prisma.eventIngredient.createMany({
          data: Array.from(newIngredientIds).map(ingredientId => ({
            eventId: params.eventId,
            ingredientId,
            quantity: 0,
            priceAtEvent: priceMap.get(ingredientId) || null
          }))
        })
      }
    }

    // Remove items
    if (removeItems && Array.isArray(removeItems) && removeItems.length > 0) {
      await prisma.eventItem.deleteMany({
        where: {
          eventId: params.eventId,
          itemId: { in: removeItems }
        }
      })

      const remainingItems = await prisma.eventItem.findMany({
        where: { eventId: params.eventId },
        select: { item: { select: { itemIngredients: { select: { ingredientId: true } } } } }
      })

      const neededIngredientIds = new Set<string>()
      remainingItems.forEach(ei => {
        ei.item.itemIngredients.forEach(ii => {
          neededIngredientIds.add(ii.ingredientId)
        })
      })

      await prisma.eventIngredient.deleteMany({
        where: {
          eventId: params.eventId,
          ingredientId: { notIn: Array.from(neededIngredientIds) },
          quantity: 0
        }
      })
    }

    // Return minimal response - client will refetch if needed
    return NextResponse.json({ success: true, data: { id: params.eventId } })
  } catch (error) {
    console.error("Error updating event:", error)
    return NextResponse.json({ success: false, error: "Failed to update event" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    await prisma.event.delete({ where: { id: params.eventId } })
    return NextResponse.json({ success: true, message: "Event deleted" })
  } catch (error) {
    console.error("Error deleting event:", error)
    return NextResponse.json({ success: false, error: "Failed to delete event" }, { status: 500 })
  }
}
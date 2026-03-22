import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

async function recalcTotalAmount(eventId: string) {
  const allItems = await prisma.eventItem.findMany({
    where: { eventId },
    select: { mealLabel: true, mealDate: true, mealGuests: true, mealPerPlate: true }
  })
  const mealCosts = new Map<string, number>()
  allItems.forEach(item => {
    const key = `${item.mealLabel || "default"}::${item.mealDate ? String(item.mealDate).split("T")[0] : ""}`
    if (!mealCosts.has(key)) {
      mealCosts.set(key, (item.mealGuests || 0) * (item.mealPerPlate || 0))
    }
  })
  const newTotal = Array.from(mealCosts.values()).reduce((sum, c) => sum + c, 0)
  await prisma.event.update({ where: { id: eventId }, data: { totalAmount: newTotal } })
}

export async function GET(
  req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const event = await prisma.event.findUnique({
      where: { id: params.eventId },
      select: {
        id: true, eventId: true, organizerName: true, phoneNumber: true,
        location: true, bookingDate: true, functionDate: true, functionTime: true,
        menuCreationDate: true, guestCount: true, perPlatePrice: true,
        totalAmount: true, advancePayment: true, status: true, notes: true,
        eventItems: {
          select: {
            id: true, itemId: true, mealLabel: true, mealDate: true,
            mealGuests: true, mealPerPlate: true,
            item: { select: { id: true, name: true, category: { select: { id: true, name: true } } } }
          }
        },
        eventIngredients: {
          select: {
            id: true, ingredientId: true, quantity: true, priceAtEvent: true, status: true,notes: true,
            ingredient: {
              select: { id: true, name: true, unit: true, ratePerUnit: true, category: { select: { id: true, name: true } } }
            }
          }
        },
        eventCategorySettings: { select: { id: true, ingredientCategoryId: true, boughtBy: true } },
        advancePayments: { select: { id: true, amount: true, paidDate: true, notes: true, createdAt: true }, orderBy: { paidDate: "asc" } }
      }
    })

    if (!event) return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 })
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
    if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { status, addItems, removeItems, removeMealLabel, updateMealLabels, ...updateData } = body

    const updatePayload: any = {}
    if (status) updatePayload.status = status
    if (updateData.organizerName) updatePayload.organizerName = updateData.organizerName
    if (updateData.phoneNumber) updatePayload.phoneNumber = updateData.phoneNumber
    if (updateData.location) updatePayload.location = updateData.location
    if (updateData.functionDate) updatePayload.functionDate = new Date(updateData.functionDate)
    if (updateData.functionTime) updatePayload.functionTime = updateData.functionTime
    if (updateData.guestCount) updatePayload.guestCount = parseInt(updateData.guestCount)
    if (updateData.notes !== undefined) updatePayload.notes = updateData.notes
    if (updateData.perPlatePrice !== undefined) updatePayload.perPlatePrice = parseFloat(updateData.perPlatePrice) || 0
    if (updateData.totalAmount !== undefined) updatePayload.totalAmount = parseFloat(updateData.totalAmount) || 0

    if (Object.keys(updatePayload).length > 0) {
      await prisma.event.update({ where: { id: params.eventId }, data: updatePayload })
    }

    // Update meal label metadata (date, type, guests, perPlate) per label+date group
    if (updateMealLabels && Array.isArray(updateMealLabels)) {
      for (const meal of updateMealLabels) {
        const whereClause: any = { eventId: params.eventId, mealLabel: meal.mealLabel }
        if (meal.mealDate) {
          const dateStart = new Date(meal.mealDate); dateStart.setHours(0, 0, 0, 0)
          const dateEnd = new Date(meal.mealDate); dateEnd.setHours(23, 59, 59, 999)
          whereClause.mealDate = { gte: dateStart, lte: dateEnd }
        }
        
        const updateData: any = {}
        if (meal.mealGuests != null) updateData.mealGuests = parseInt(String(meal.mealGuests))
        if (meal.mealPerPlate != null) updateData.mealPerPlate = parseFloat(String(meal.mealPerPlate))
        if (meal.newMealLabel) updateData.mealLabel = meal.newMealLabel
        if (meal.newMealDate) updateData.mealDate = new Date(meal.newMealDate)
        
        if (Object.keys(updateData).length > 0) {
          await prisma.eventItem.updateMany({ where: whereClause, data: updateData })
        }
      }
    }

    // Add items
    if (addItems && Array.isArray(addItems) && addItems.length > 0) {
      const itemsToAdd = addItems.map((item: any) => {
        if (typeof item === 'string') return { itemId: item, mealLabel: null, mealDate: null, mealGuests: null, mealPerPlate: null }
        return {
          itemId: item.itemId, mealLabel: item.mealLabel || null,
          mealDate: item.mealDate ? new Date(item.mealDate) : null,
          mealGuests: item.mealGuests != null ? parseInt(String(item.mealGuests)) : null,
          mealPerPlate: item.mealPerPlate != null ? parseFloat(String(item.mealPerPlate)) : null
        }
      })

      const items = await prisma.item.findMany({
        where: { id: { in: itemsToAdd.map((i: any) => i.itemId) } },
        select: { id: true, itemIngredients: { select: { ingredientId: true } } }
      })

      await prisma.eventItem.createMany({
        data: itemsToAdd.map((item: any) => ({
          eventId: params.eventId, itemId: item.itemId, mealLabel: item.mealLabel,
          mealDate: item.mealDate, mealGuests: item.mealGuests, mealPerPlate: item.mealPerPlate
        }))
      })

      const existingIngredients = await prisma.eventIngredient.findMany({ where: { eventId: params.eventId }, select: { ingredientId: true } })
      const existingIds = new Set(existingIngredients.map(e => e.ingredientId))
      const newIds = new Set<string>()
      items.forEach(item => { item.itemIngredients.forEach(ii => { if (!existingIds.has(ii.ingredientId)) newIds.add(ii.ingredientId) }) })

      if (newIds.size > 0) {
        const prices = await prisma.ingredient.findMany({ where: { id: { in: Array.from(newIds) } }, select: { id: true, ratePerUnit: true } })
        const priceMap = new Map(prices.map(i => [i.id, i.ratePerUnit]))
        await prisma.eventIngredient.createMany({
          data: Array.from(newIds).map(id => ({ eventId: params.eventId, ingredientId: id, quantity: 0, priceAtEvent: priceMap.get(id) || null }))
        })
      }
    }

    // Remove items
    if (removeItems && Array.isArray(removeItems) && removeItems.length > 0) {
      await prisma.eventItem.deleteMany({ where: { eventId: params.eventId, id: { in: removeItems } } })
      const remaining = await prisma.eventItem.findMany({ where: { eventId: params.eventId }, select: { item: { select: { itemIngredients: { select: { ingredientId: true } } } } } })
      const needed = new Set<string>()
      remaining.forEach(ei => { ei.item.itemIngredients.forEach(ii => needed.add(ii.ingredientId)) })
      await prisma.eventIngredient.deleteMany({ where: { eventId: params.eventId, ingredientId: { notIn: Array.from(needed) }, quantity: 0 } })
    }

    // Remove meal label
    if (removeMealLabel) {
      await prisma.eventItem.deleteMany({ where: { eventId: params.eventId, mealLabel: removeMealLabel } })
      const remaining = await prisma.eventItem.findMany({ where: { eventId: params.eventId }, select: { item: { select: { itemIngredients: { select: { ingredientId: true } } } } } })
      const needed = new Set<string>()
      remaining.forEach(ei => { ei.item.itemIngredients.forEach(ii => needed.add(ii.ingredientId)) })
      if (needed.size > 0) { await prisma.eventIngredient.deleteMany({ where: { eventId: params.eventId, ingredientId: { notIn: Array.from(needed) }, quantity: 0 } }) }
      else { await prisma.eventIngredient.deleteMany({ where: { eventId: params.eventId, quantity: 0 } }) }
    }

    // Recalc total
    if (addItems || removeItems || removeMealLabel || updateMealLabels) {
      await recalcTotalAmount(params.eventId)
    }

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
    if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    await prisma.event.delete({ where: { id: params.eventId } })
    return NextResponse.json({ success: true, message: "Event deleted" })
  } catch (error) {
    console.error("Error deleting event:", error)
    return NextResponse.json({ success: false, error: "Failed to delete event" }, { status: 500 })
  }
}
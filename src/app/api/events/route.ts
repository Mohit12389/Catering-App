import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { generateEventId } from "@/lib/utils"
import { getEffectiveUserId } from "@/lib/getEffectiveUserId"

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true, role: true, ownerId: true } })
    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")

    const events = await prisma.event.findMany({
      where: {
        userId: getEffectiveUserId(dbUser),
        ...(status && { status })
      },
      select: {
        id: true, eventId: true, organizerName: true, phoneNumber: true,
        location: true, homeAddress: true, bookingDate: true, functionDate: true, functionTime: true,
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
          where: { quantity: { gt: 0 } },
          select: { id: true },
          take: 1
        }
      },
      orderBy: { functionDate: "desc" }
    })

    // Build unique meal labels for each event (for card display)
    const transformed = events.map(event => {
      const mealsMap = new Map<string, { label: string; date: any; guests: number | null }>()
      event.eventItems.forEach(ei => {
        if (ei.mealLabel) {
          const key = `${ei.mealLabel}-${ei.mealDate || ''}`
          if (!mealsMap.has(key)) {
            mealsMap.set(key, { label: ei.mealLabel, date: ei.mealDate, guests: ei.mealGuests })
          }
        }
      })
      return {
        ...event,
        eventIngredients: event.eventIngredients.length > 0 ? [{ id: 'has-qty', quantity: 1 }] : [],
        mealLabels: Array.from(mealsMap.values())
      }
    })

    return NextResponse.json({ success: true, data: transformed })
  } catch (error) {
    console.error("Error fetching events:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch events" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true, role: true, ownerId: true } })
    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const body = await req.json()
    const { organizerName, phoneNumber, location, homeAddress, functionDate, functionTime,
            menuCreationDate, guestCount, totalAmount, notes, meals } = body

    if (!organizerName || !phoneNumber || !location || !functionDate || !functionTime) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
    }
    if (!meals || !Array.isArray(meals) || meals.length === 0) {
      return NextResponse.json({ success: false, error: "At least one meal is required" }, { status: 400 })
    }

    // Collect all item IDs to get their ingredients
    const allItemIds = Array.from(new Set(meals.flatMap((m: any) => m.selectedItems || [])))

    const itemsWithIngredients = await prisma.item.findMany({
      where: { id: { in: allItemIds } },
      select: {
        id: true,
        itemIngredients: {
          select: { ingredientId: true, ingredient: { select: { id: true, ratePerUnit: true } } }
        }
      }
    })

    const ingredientPriceMap = new Map<string, number>()
    itemsWithIngredients.forEach(item => {
      item.itemIngredients.forEach(ii => {
        if (!ingredientPriceMap.has(ii.ingredientId)) {
          ingredientPriceMap.set(ii.ingredientId, ii.ingredient?.ratePerUnit || 0)
        }
      })
    })

    // Build EventItem rows — each item tagged with its meal label
    const eventItemsData: any[] = []
    meals.forEach((meal: any) => {
      (meal.selectedItems || []).forEach((itemId: string) => {
        eventItemsData.push({
          itemId,
          mealLabel: meal.mealType || null,
          mealDate: meal.mealDate ? new Date(meal.mealDate) : null,
          mealGuests: parseInt(meal.guestCount) || null,
          mealPerPlate: parseFloat(meal.perPlatePrice) || null
        })
      })
    })

    const event = await prisma.event.create({
      data: {
        eventId: generateEventId(),
        organizerName,
        phoneNumber,
        location,
        homeAddress: homeAddress || null,
        bookingDate: new Date(),
        functionDate: new Date(functionDate),
        functionTime,
        menuCreationDate: menuCreationDate ? new Date(menuCreationDate) : new Date(),
        guestCount: parseInt(guestCount) || 0,
        perPlatePrice: 0,
        totalAmount: parseFloat(totalAmount) || 0,
        advancePayment: 0,
        notes: notes || null,
        userId: getEffectiveUserId(dbUser),
        eventItems: { create: eventItemsData },
        eventIngredients: {
          create: Array.from(ingredientPriceMap.entries()).map(([ingredientId, price]) => ({
            ingredientId, quantity: 0, priceAtEvent: price
          }))
        }
      },
      select: { id: true, eventId: true, organizerName: true }
    })

    return NextResponse.json({ success: true, data: event }, { status: 201 })
  } catch (error) {
    console.error("Error creating event:", error)
    return NextResponse.json({ success: false, error: "Failed to create event" }, { status: 500 })
  }
}
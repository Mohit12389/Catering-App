import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { generateEventId } from "@/lib/utils"

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
    const status = searchParams.get("status")

    const events = await prisma.event.findMany({
      where: {
        userId: dbUser.id,
        ...(status && { status })
      },
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
                category: {
                  select: { id: true, name: true }
                }
              }
            }
          }
        },
        _count: {
          select: {
            eventIngredients: true
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

    // Transform data
    const transformed = events.map(event => ({
      ...event,
      eventIngredients: event.eventIngredients.length > 0 
        ? [{ id: 'has-qty', quantity: 1 }] 
        : []
    }))

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

    const dbUser = await prisma.user.findUnique({ 
      where: { clerkId: userId },
      select: { id: true }
    })
    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const body = await req.json()
    const {
      organizerName,
      phoneNumber,
      location,
      functionDate,
      functionTime,
      menuCreationDate,
      guestCount,
      perPlatePrice,
      totalAmount,
      advancePayment,
      notes,
      selectedItems = []
    } = body

    if (!organizerName || !phoneNumber || !location || !functionDate || !functionTime || !guestCount) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
    }

    // Get ingredient IDs from selected items WITH their current prices
    const itemsWithIngredients = await prisma.item.findMany({
      where: { id: { in: selectedItems } },
      select: {
        id: true,
        itemIngredients: {
          select: { 
            ingredientId: true,
            ingredient: {
              select: {
                id: true,
                ratePerUnit: true
              }
            }
          }
        }
      }
    })

    // Collect unique ingredients with their current prices
    const ingredientPriceMap = new Map<string, number>()
    itemsWithIngredients.forEach(item => {
      item.itemIngredients.forEach(ii => {
        if (!ingredientPriceMap.has(ii.ingredientId)) {
          ingredientPriceMap.set(ii.ingredientId, ii.ingredient?.ratePerUnit || 0)
        }
      })
    })

    // Create event with items and ingredients in one transaction
    const event = await prisma.event.create({
      data: {
        eventId: generateEventId(),
        organizerName,
        phoneNumber,
        location,
        bookingDate: new Date(),
        functionDate: new Date(functionDate),
        functionTime,
        menuCreationDate: menuCreationDate ? new Date(menuCreationDate) : new Date(),
        guestCount: parseInt(guestCount),
        perPlatePrice: parseFloat(perPlatePrice) || 0,
        totalAmount: parseFloat(totalAmount) || 0,
        advancePayment: parseFloat(advancePayment) || 0,
        notes: notes || null,
        userId: dbUser.id,
        eventItems: {
          create: selectedItems.map((itemId: string) => ({ itemId }))
        },
        eventIngredients: {
          // Create event ingredients WITH priceAtEvent set to current ratePerUnit
          create: Array.from(ingredientPriceMap.entries()).map(([ingredientId, price]) => ({
            ingredientId,
            quantity: 0,
            priceAtEvent: price  // ← THIS IS THE KEY FIX!
          }))
        }
      },
      select: {
        id: true,
        eventId: true,
        organizerName: true
      }
    })

    return NextResponse.json({ success: true, data: event }, { status: 201 })
  } catch (error) {
    console.error("Error creating event:", error)
    return NextResponse.json({ success: false, error: "Failed to create event" }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { getEffectiveUserId } from "@/lib/getEffectiveUserId"

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({ 
      where: { clerkId: userId },
      select: { id: true, role: true, ownerId: true  }
    })
    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const categoryId = searchParams.get("categoryId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const boughtBy = searchParams.get("boughtBy") // 'caterer' or 'client' or null for all

    if (!categoryId || !startDate || !endDate) {
      return NextResponse.json({ 
        success: false, 
        error: "categoryId, startDate, and endDate are required" 
      }, { status: 400 })
    }

    // Get events in date range - don't filter by boughtBy in query, do it later
    const events = await prisma.event.findMany({
      where: {
        userId: getEffectiveUserId(dbUser),
        status: 'active',
        functionDate: {
          gte: new Date(startDate),
          lte: new Date(endDate + 'T23:59:59')
        }
      },
      select: {
        id: true,
        eventId: true,
        organizerName: true,
        phoneNumber: true,
        location: true,
        functionDate: true,
        eventIngredients: {
          where: {
            ingredient: {
              categoryId: categoryId
            },
            quantity: { gt: 0 }
          },
          select: {
            quantity: true,
            notes: true,
            ingredient: {
              select: {
                name: true,
                unit: true
              }
            }
          }
        },
        eventCategorySettings: {
          where: {
            ingredientCategoryId: categoryId
          },
          select: {
            boughtBy: true
          }
        }
      },
      orderBy: { functionDate: 'asc' }
    })

    // Filter events based on boughtBy if specified
    let filteredEvents = events
    if (boughtBy && boughtBy !== 'all') {
      filteredEvents = events.filter(event => {
        const setting = event.eventCategorySettings[0]
        // If no setting exists, default is 'caterer'
        const eventBoughtBy = setting?.boughtBy || 'caterer'
        return eventBoughtBy === boughtBy
      })
    }

    // Transform data - only include events that have ingredients in this category
    const result = filteredEvents
      .filter(event => event.eventIngredients.length > 0)
      .map(event => ({
        eventId: event.eventId,
        organizerName: event.organizerName,
        phoneNumber: event.phoneNumber,
        location: event.location,
        functionDate: event.functionDate,
        ingredients: event.eventIngredients.map(ei => ({
          name: ei.ingredient.name,
          quantity: ei.quantity,
          unit: ei.ingredient.unit,
          notes: ei.notes || null
        }))
      }))

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error("Error generating categories print:", error)
    return NextResponse.json({ success: false, error: "Failed to generate report" }, { status: 500 })
  }
}

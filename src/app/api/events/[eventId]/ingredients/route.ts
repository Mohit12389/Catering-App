import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

// GET - Get all ingredients for an event
export async function GET(
  req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const ingredients = await prisma.eventIngredient.findMany({
      where: { eventId: params.eventId },
      include: {
        ingredient: { include: { category: true } }
      }
    })

    return NextResponse.json({ success: true, data: ingredients })
  } catch (error) {
    console.error("Error fetching event ingredients:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch ingredients" }, { status: 500 })
  }
}

// POST - Save/update ingredient quantities for an event
export async function POST(
  req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { ingredients } = await req.json()

    if (!Array.isArray(ingredients)) {
      return NextResponse.json({ success: false, error: "ingredients must be an array" }, { status: 400 })
    }

    // Update quantities for each ingredient
    for (const { ingredientId, quantity } of ingredients) {
      await prisma.eventIngredient.upsert({
        where: {
          eventId_ingredientId: {
            eventId: params.eventId,
            ingredientId
          }
        },
        update: { quantity },
        create: {
          eventId: params.eventId,
          ingredientId,
          quantity
        }
      })
    }

    // Fetch updated ingredients
    const updatedIngredients = await prisma.eventIngredient.findMany({
      where: { eventId: params.eventId },
      include: {
        ingredient: { include: { category: true } }
      }
    })

    return NextResponse.json({ success: true, data: updatedIngredients })
  } catch (error) {
    console.error("Error saving event ingredients:", error)
    return NextResponse.json({ success: false, error: "Failed to save ingredients" }, { status: 500 })
  }
}

// PUT - Refresh ingredients from item recipes (re-populate)
export async function PUT(
  req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Get all items for this event
    const eventItems = await prisma.eventItem.findMany({
      where: { eventId: params.eventId },
      include: {
        item: {
          include: { itemIngredients: true }
        }
      }
    })

    // Collect all ingredient IDs from item recipes
    const ingredientIds = new Set<string>()
    eventItems.forEach(ei => {
      ei.item.itemIngredients.forEach(ii => {
        ingredientIds.add(ii.ingredientId)
      })
    })

    // Get existing event ingredients to preserve quantities
    const existingIngredients = await prisma.eventIngredient.findMany({
      where: { eventId: params.eventId }
    })
    const existingQuantities = new Map(
      existingIngredients.map(ei => [ei.ingredientId, ei.quantity])
    )

    // Delete ingredients that are no longer in any recipe
    await prisma.eventIngredient.deleteMany({
      where: {
        eventId: params.eventId,
        ingredientId: { notIn: Array.from(ingredientIds) }
      }
    })

    // Upsert ingredients
    for (const ingredientId of ingredientIds) {
      await prisma.eventIngredient.upsert({
        where: {
          eventId_ingredientId: {
            eventId: params.eventId,
            ingredientId
          }
        },
        update: {},
        create: {
          eventId: params.eventId,
          ingredientId,
          quantity: existingQuantities.get(ingredientId) || 0
        }
      })
    }

    // Fetch updated ingredients
    const updatedIngredients = await prisma.eventIngredient.findMany({
      where: { eventId: params.eventId },
      include: {
        ingredient: { include: { category: true } }
      }
    })

    return NextResponse.json({ success: true, data: updatedIngredients })
  } catch (error) {
    console.error("Error refreshing event ingredients:", error)
    return NextResponse.json({ success: false, error: "Failed to refresh ingredients" }, { status: 500 })
  }
}

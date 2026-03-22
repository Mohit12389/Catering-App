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

// POST - Save/update ingredient quantities (and notes) for an event
// IMPORTANT: This only updates quantity and notes, NOT priceAtEvent
// priceAtEvent is set by bulk-price-update API
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

    // Update quantities and notes for each ingredient
    // DO NOT touch priceAtEvent - it should only be changed by bulk-price-update
    for (const { ingredientId, quantity, notes } of ingredients) {
      // Check if event ingredient already exists
      const existing = await prisma.eventIngredient.findUnique({
        where: {
          eventId_ingredientId: {
            eventId: params.eventId,
            ingredientId
          }
        }
      })

      if (existing) {
        // Only update quantity and notes, preserve priceAtEvent
        await prisma.eventIngredient.update({
          where: {
            eventId_ingredientId: {
              eventId: params.eventId,
              ingredientId
            }
          },
          data: {
            quantity,
            // Only update notes if it was provided in the request
            ...(notes !== undefined && { notes })
          }
        })
      } else {
        // New ingredient - get current price from ingredient master
        const ingredient = await prisma.ingredient.findUnique({
          where: { id: ingredientId },
          select: { ratePerUnit: true }
        })

        await prisma.eventIngredient.create({
          data: {
            eventId: params.eventId,
            ingredientId,
            quantity,
            priceAtEvent: ingredient?.ratePerUnit || null,
            notes: notes || null
          }
        })
      }
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

    // Get existing event ingredients to preserve quantities, priceAtEvent, AND notes
    const existingIngredients = await prisma.eventIngredient.findMany({
      where: { eventId: params.eventId }
    })
    const existingData = new Map(
      existingIngredients.map(ei => [ei.ingredientId, {
        quantity: ei.quantity,
        priceAtEvent: ei.priceAtEvent,
        notes: ei.notes
      }])
    )

    // Delete ingredients that are no longer in any recipe
    await prisma.eventIngredient.deleteMany({
      where: {
        eventId: params.eventId,
        ingredientId: { notIn: Array.from(ingredientIds) }
      }
    })

    // Get current prices for new ingredients
    const newIngredientIds = Array.from(ingredientIds).filter(id => !existingData.has(id))
    const ingredientPrices = await prisma.ingredient.findMany({
      where: { id: { in: newIngredientIds } },
      select: { id: true, ratePerUnit: true }
    })
    const priceMap = new Map(ingredientPrices.map(i => [i.id, i.ratePerUnit]))

    // Upsert ingredients - preserve existing data, set price for new ones
    for (const ingredientId of ingredientIds) {
      const existing = existingData.get(ingredientId)
      
      await prisma.eventIngredient.upsert({
        where: {
          eventId_ingredientId: {
            eventId: params.eventId,
            ingredientId
          }
        },
        update: {}, // Don't change anything for existing
        create: {
          eventId: params.eventId,
          ingredientId,
          quantity: existing?.quantity || 0,
          priceAtEvent: existing?.priceAtEvent || priceMap.get(ingredientId) || null,
          notes: existing?.notes || null
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
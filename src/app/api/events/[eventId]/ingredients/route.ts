import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/withAuth" // CHANGED: replaces the repeated auth/dbUser/try-catch preamble
import { planIngredientSave, newIngredientIds } from "@/lib/eventIngredients" // CHANGED: batched save

// CHANGED: shared helper — confirms this eventId actually belongs to the requesting
// business. It no longer looks the user up itself: withAuth has already resolved
// effectiveUserId, so this is one query per request instead of two.
async function ownsEvent(effectiveUserId: string, eventId: string) {
  const event = await prisma.event.findFirst({ where: { id: eventId, userId: effectiveUserId }, select: { id: true } })
  return !!event
}

type Ctx = { params: { eventId: string } }

// GET - Get all ingredients for an event
export const GET = withAuth<Ctx>(async (_req, { effectiveUserId }, { params }) => {
    // don't return another business's event ingredients
    if (!(await ownsEvent(effectiveUserId, params.eventId))) {
      return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 })
    }

    const ingredients = await prisma.eventIngredient.findMany({
      where: { eventId: params.eventId },
      include: {
        ingredient: { include: { category: true } }
      }
    })

    return NextResponse.json({ success: true, data: ingredients })
})

// POST - Save/update ingredient quantities (and notes) for an event
// IMPORTANT: This only updates quantity and notes, NOT priceAtEvent
// priceAtEvent is set by bulk-price-update API
export const POST = withAuth<Ctx>(async (req: NextRequest, { effectiveUserId }, { params }) => {
    // don't let someone write ingredient quantities onto another business's event
    if (!(await ownsEvent(effectiveUserId, params.eventId))) {
      return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 })
    }

    const { ingredients } = await req.json()

    if (!Array.isArray(ingredients)) {
      return NextResponse.json({ success: false, error: "ingredients must be an array" }, { status: 400 })
    }

    // Update quantities and notes for each ingredient.
    // DO NOT touch priceAtEvent — it should only be changed by bulk-price-update.
    //
    // CHANGED: this was a loop doing a findUnique per submitted ingredient plus an
    // update, or a second lookup plus a create. ~160 round-trips to Neon for an event
    // with 80 ingredients, which is seconds of waiting on a daily save. It is now a
    // fixed number of queries whatever the ingredient count: read what exists, read
    // the master rates for the new ones, one createMany, and the updates batched.
    const existing = await prisma.eventIngredient.findMany({
      where: { eventId: params.eventId },
      select: { ingredientId: true }
    })
    const existingIds = new Set(existing.map(e => e.ingredientId))

    // Only the NEW ingredients need their master rate; updates preserve priceAtEvent.
    const needRates = newIngredientIds(ingredients, existingIds)
    const rates = needRates.length
      ? await prisma.ingredient.findMany({
          where: { id: { in: needRates } },
          select: { id: true, ratePerUnit: true }
        })
      : []
    const rateById = new Map(rates.map(r => [r.id, r.ratePerUnit]))

    const { updates, creates } = planIngredientSave(ingredients, existingIds, rateById)

    if (creates.length > 0) {
      await prisma.eventIngredient.createMany({
        data: creates.map(c => ({ ...c, eventId: params.eventId }))
      })
    }

    if (updates.length > 0) {
      // Each row has its own quantity/notes/status, so updateMany cannot express this.
      // $transaction sends them as one batch instead of one round-trip each — and makes
      // the save all-or-nothing, where a mid-loop failure used to leave it half applied.
      await prisma.$transaction(
        updates.map(u =>
          prisma.eventIngredient.update({
            where: { eventId_ingredientId: { eventId: params.eventId, ingredientId: u.ingredientId } },
            data: u.data
          })
        )
      )
    }

    // Fetch updated ingredients
    const updatedIngredients = await prisma.eventIngredient.findMany({
      where: { eventId: params.eventId },
      include: {
        ingredient: { include: { category: true } }
      }
    })

    return NextResponse.json({ success: true, data: updatedIngredients })
})

// PUT - Refresh ingredients from item recipes (re-populate)
export const PUT = withAuth<Ctx>(async (_req, { effectiveUserId }, { params }) => {
    // don't let someone refresh/repopulate ingredients on another business's event
    if (!(await ownsEvent(effectiveUserId, params.eventId))) {
      return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 })
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

    // CHANGED: this was an upsert per ingredient, one query each. Its `update: {}` meant
    // existing rows were deliberately left alone, so the loop only ever CREATED the
    // missing ones — which a single createMany does in one query. skipDuplicates keeps
    // it safe if two refreshes race.
    const missing = Array.from(ingredientIds).filter(id => !existingData.has(id))
    if (missing.length > 0) {
      await prisma.eventIngredient.createMany({
        data: missing.map(ingredientId => ({
          eventId: params.eventId,
          ingredientId,
          quantity: 0,
          priceAtEvent: priceMap.get(ingredientId) || null,
          notes: null
        })),
        skipDuplicates: true
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
})

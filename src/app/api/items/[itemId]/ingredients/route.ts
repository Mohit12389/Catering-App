import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/withAuth" // CHANGED: replaces the repeated auth/dbUser/try-catch preamble

// CHANGED: shared helper — confirms this itemId actually belongs to the requesting
// business. It no longer looks the user up itself: withAuth has already resolved
// effectiveUserId, so this is one query per request instead of two.
async function ownsItem(effectiveUserId: string, itemId: string) {
  const item = await prisma.item.findFirst({
    where: { id: itemId, userId: effectiveUserId },
    select: { id: true }
  })
  return !!item
}

type Ctx = { params: { itemId: string } }

// GET ingredients for a specific item
export const GET = withAuth<Ctx>(async (_req, { effectiveUserId }, { params }) => {
  // don't return another business's item recipe
  if (!(await ownsItem(effectiveUserId, params.itemId))) {
    return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 })
  }

  const itemIngredients = await prisma.itemIngredient.findMany({
    where: { itemId: params.itemId },
    include: {
      ingredient: { include: { category: true } }
    }
  })

  return NextResponse.json({ success: true, data: itemIngredients })
})

// POST - Set ingredients for an item (Recipe)
export const POST = withAuth<Ctx>(async (req: NextRequest, { effectiveUserId }, { params }) => {
  // don't let someone overwrite the recipe of another business's item
  if (!(await ownsItem(effectiveUserId, params.itemId))) {
    return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 })
  }

  const { ingredientIds } = await req.json()

  if (!Array.isArray(ingredientIds)) {
    return NextResponse.json({ success: false, error: "ingredientIds must be an array" }, { status: 400 })
  }

  // Delete existing ingredients for this item
  await prisma.itemIngredient.deleteMany({
    where: { itemId: params.itemId }
  })

  // Create new ingredient links
  if (ingredientIds.length > 0) {
    await prisma.itemIngredient.createMany({
      data: ingredientIds.map((ingredientId: string) => ({
        itemId: params.itemId,
        ingredientId
      }))
    })
  }

  // Fetch updated item with ingredients
  const item = await prisma.item.findUnique({
    where: { id: params.itemId },
    include: {
      category: true,
      itemIngredients: {
        include: { ingredient: { include: { category: true } } }
      }
    }
  })

  return NextResponse.json({ success: true, data: item })
})

// DELETE - Remove a specific ingredient from item
export const DELETE = withAuth<Ctx>(async (req: NextRequest, { effectiveUserId }, { params }) => {
  // don't let someone remove an ingredient from another business's item
  if (!(await ownsItem(effectiveUserId, params.itemId))) {
    return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 })
  }

  const { searchParams } = new URL(req.url)
  const ingredientId = searchParams.get("ingredientId")

  if (!ingredientId) {
    return NextResponse.json({ success: false, error: "ingredientId is required" }, { status: 400 })
  }

  await prisma.itemIngredient.delete({
    where: {
      itemId_ingredientId: {
        itemId: params.itemId,
        ingredientId
      }
    }
  })

  return NextResponse.json({ success: true, message: "Ingredient removed from item" })
})

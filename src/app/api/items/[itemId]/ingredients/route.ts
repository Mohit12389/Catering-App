import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

// GET ingredients for a specific item
export async function GET(
  req: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const itemIngredients = await prisma.itemIngredient.findMany({
      where: { itemId: params.itemId },
      include: {
        ingredient: { include: { category: true } }
      }
    })

    return NextResponse.json({ success: true, data: itemIngredients })
  } catch (error) {
    console.error("Error fetching item ingredients:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch ingredients" }, { status: 500 })
  }
}

// POST - Set ingredients for an item (Recipe)
export async function POST(
  req: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
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
  } catch (error) {
    console.error("Error saving item ingredients:", error)
    return NextResponse.json({ success: false, error: "Failed to save ingredients" }, { status: 500 })
  }
}

// DELETE - Remove a specific ingredient from item
export async function DELETE(
  req: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
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
  } catch (error) {
    console.error("Error removing item ingredient:", error)
    return NextResponse.json({ success: false, error: "Failed to remove ingredient" }, { status: 500 })
  }
}

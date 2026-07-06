import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { getEffectiveUserId } from "@/lib/getEffectiveUserId"

// PUT - Update sort order for a single item/category with shift logic
export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const { type, id, newSortOrder } = await req.json()
    // type: "itemCategory" | "ingredientCategory" | "ingredient"
    // id: the record's ID
    // newSortOrder: the desired priority number

    if (!type || !id || newSortOrder === undefined) {
      return NextResponse.json({ 
        success: false, 
        error: "type, id, and newSortOrder are required" 
      }, { status: 400 })
    }

    const sortOrder = parseInt(newSortOrder)
    if (isNaN(sortOrder) || sortOrder < 0) {
      return NextResponse.json({ 
        success: false, 
        error: "sortOrder must be a non-negative integer" 
      }, { status: 400 })
    }

    if (type === "itemCategory") {
      // Verify ownership
      const category = await prisma.itemCategory.findFirst({
        where: { id, userId: getEffectiveUserId(dbUser) }
      })
      if (!category) {
        return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 })
      }

      const oldSortOrder = category.sortOrder

      if (oldSortOrder !== sortOrder) {
        // Shift other categories to make room
        if (sortOrder < oldSortOrder || oldSortOrder === 0) {
          // Moving UP (or from unset): shift items at or after new position DOWN by 1
          await prisma.itemCategory.updateMany({
            where: {
              userId: getEffectiveUserId(dbUser),
              id: { not: id },
              sortOrder: { gte: sortOrder }
            },
            data: { sortOrder: { increment: 1 } }
          })
        } else {
          // Moving DOWN: shift items between old+1 and new position UP by 1
          await prisma.itemCategory.updateMany({
            where: {
              userId: getEffectiveUserId(dbUser),
              id: { not: id },
              sortOrder: { gt: oldSortOrder, lte: sortOrder }
            },
            data: { sortOrder: { decrement: 1 } }
          })
        }

        // Set the target's sort order
        await prisma.itemCategory.update({
          where: { id },
          data: { sortOrder }
        })
      }

      return NextResponse.json({ success: true, message: "Item category order updated" })

    } else if (type === "ingredientCategory") {
      const category = await prisma.ingredientCategory.findFirst({
        where: { id, userId: getEffectiveUserId(dbUser)}
      })
      if (!category) {
        return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 })
      }

      const oldSortOrder = category.sortOrder

      if (oldSortOrder !== sortOrder) {
        if (sortOrder < oldSortOrder || oldSortOrder === 0) {
          await prisma.ingredientCategory.updateMany({
            where: {
              userId: getEffectiveUserId(dbUser),
              id: { not: id },
              sortOrder: { gte: sortOrder }
            },
            data: { sortOrder: { increment: 1 } }
          })
        } else {
          await prisma.ingredientCategory.updateMany({
            where: {
              userId: getEffectiveUserId(dbUser),
              id: { not: id },
              sortOrder: { gt: oldSortOrder, lte: sortOrder }
            },
            data: { sortOrder: { decrement: 1 } }
          })
        }

        await prisma.ingredientCategory.update({
          where: { id },
          data: { sortOrder }
        })
      }

      return NextResponse.json({ success: true, message: "Ingredient category order updated" })

    } else if (type === "ingredient") {
      const ingredient = await prisma.ingredient.findFirst({
        where: { id, userId: getEffectiveUserId(dbUser)}
      })
      if (!ingredient) {
        return NextResponse.json({ success: false, error: "Ingredient not found" }, { status: 404 })
      }

      const oldSortOrder = ingredient.sortOrder

      if (oldSortOrder !== sortOrder) {
        // Shift only within the SAME category
        if (sortOrder < oldSortOrder || oldSortOrder === 0) {
          await prisma.ingredient.updateMany({
            where: {
              userId: getEffectiveUserId(dbUser),
              categoryId: ingredient.categoryId,
              id: { not: id },
              sortOrder: { gte: sortOrder }
            },
            data: { sortOrder: { increment: 1 } }
          })
        } else {
          await prisma.ingredient.updateMany({
            where: {
              userId: getEffectiveUserId(dbUser),
              categoryId: ingredient.categoryId,
              id: { not: id },
              sortOrder: { gt: oldSortOrder, lte: sortOrder },
            },
            data: { sortOrder: { decrement: 1 } }
          })
        }

        await prisma.ingredient.update({
          where: { id },
          data: { sortOrder }
        })
      }

      return NextResponse.json({ success: true, message: "Ingredient order updated" })

    } else {
      return NextResponse.json({ 
        success: false, 
        error: "Invalid type. Must be 'itemCategory', 'ingredientCategory', or 'ingredient'" 
      }, { status: 400 })
    }
  } catch (error) {
    console.error("Error updating sort order:", error)
    return NextResponse.json({ success: false, error: "Failed to update sort order" }, { status: 500 })
  }
}
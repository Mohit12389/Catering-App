import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { reorder, type SortableDelegate } from "@/lib/reorder"  // CHANGED: extracted shared reorder algorithm
import { withAuth } from "@/lib/withAuth"  // CHANGED: replaces the auth/dbUser/try-catch preamble

// PUT - Update sort order for a single item/category with shift logic
export const PUT = withAuth(async (req: NextRequest, { effectiveUserId }) => {
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

    // CHANGED: was three ~40-line copies of the same algorithm; now a dispatch table.
    const targets: Record<string, {
      model: SortableDelegate
      ownerScope: Record<string, any>
      narrowScope?: (record: any) => Record<string, any>
      notFound: string
      success: string
    }> = {
      itemCategory: {
        model: prisma.itemCategory,
        ownerScope: { userId: effectiveUserId },
        notFound: "Category not found",
        success: "Item category order updated"
      },
      ingredientCategory: {
        model: prisma.ingredientCategory,
        ownerScope: { userId: effectiveUserId },
        notFound: "Category not found",
        success: "Ingredient category order updated"
      },
      ingredient: {
        model: prisma.ingredient,
        ownerScope: { userId: effectiveUserId },
        // Ingredients are ranked within their own category only
        narrowScope: (rec) => ({ categoryId: rec.categoryId }),
        notFound: "Ingredient not found",
        success: "Ingredient order updated"
      }
    }

    const target = targets[type as string]
    if (!target) {
      return NextResponse.json({
        success: false,
        error: "Invalid type. Must be 'itemCategory', 'ingredientCategory', or 'ingredient'"
      }, { status: 400 })
    }

    const ok = await reorder(target.model, {
      id,
      newSortOrder: sortOrder,
      ownerScope: target.ownerScope,
      narrowScope: target.narrowScope
    })

    if (!ok) {
      return NextResponse.json({ success: false, error: target.notFound }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: target.success })
})
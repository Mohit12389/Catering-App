import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/withAuth" // CHANGED: replaces the repeated auth/dbUser/try-catch preamble

// CHANGED: all four handlers now go through withAuth, which resolves the Clerk
// session, loads the user, derives effectiveUserId (the owner's id for staff) and
// owns the generic 500 catch. Route-specific errors (P2002) stay in the handler.

export const GET = withAuth(
  async (_req, { effectiveUserId }) => {
    const ingredients = await prisma.ingredient.findMany({
      where: { userId: effectiveUserId },
      include: {
        category: { select: { id: true, name: true } }
      },
      orderBy: { name: "asc" }
    })

    return NextResponse.json({ success: true, data: ingredients })
  },
  // Preserved exactly: a user with no DB row yet gets an empty SUCCESS list, not
  // a 404, so a brand-new account renders an empty page instead of an error.
  { onMissingUser: () => NextResponse.json({ success: true, data: [] }) }
)

export const POST = withAuth(async (req: NextRequest, { effectiveUserId }) => {
  const { name, unit, categoryId, ratePerUnit } = await req.json()

  if (!name?.trim()) {
    return NextResponse.json({ success: false, error: "Ingredient name is required" }, { status: 400 })
  }
  if (!unit?.trim()) {
    return NextResponse.json({ success: false, error: "Unit is required" }, { status: 400 })
  }
  if (!categoryId) {
    return NextResponse.json({ success: false, error: "Category is required" }, { status: 400 })
  }

  const category = await prisma.ingredientCategory.findFirst({
    where: { id: categoryId, userId: effectiveUserId }
  })
  if (!category) {
    return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 })
  }

  // CHANGED: the unique rule is case-SENSITIVE in the database, so "Pyaj" and
  // "pyaj" were both accepted into the same category. Check ignoring case.
  const duplicateIng = await prisma.ingredient.findFirst({
    where: {
      userId: effectiveUserId,
      categoryId,
      name: { equals: name.trim(), mode: "insensitive" }
    },
    select: { name: true }
  })
  if (duplicateIng) {
    return NextResponse.json(
      { success: false, error: `Ingredient already exists in this category as "${duplicateIng.name}"` },
      { status: 400 }
    )
  }

  try {
    const ingredient = await prisma.ingredient.create({
      data: {
        name: name.trim(),
        unit: unit.trim(),
        ratePerUnit: parseFloat(ratePerUnit) || 0,
        categoryId,
        userId: effectiveUserId
      },
      include: {
        category: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json({ success: true, data: ingredient }, { status: 201 })
  } catch (error: any) {
    // Route-specific: unique constraint on (name, categoryId, userId)
    if (error.code === 'P2002') {
      return NextResponse.json({ success: false, error: "Ingredient already exists in this category" }, { status: 400 })
    }
    throw error
  }
})

// PUT - Update ingredient name, category, and/or unit (NOT price)
export const PUT = withAuth(async (req: NextRequest, { effectiveUserId }) => {
  const { id, name, categoryId, unit } = await req.json()

  if (!id) {
    return NextResponse.json({ success: false, error: "Ingredient ID is required" }, { status: 400 })
  }

  // Verify ownership
  const existingIngredient = await prisma.ingredient.findFirst({
    where: { id, userId: effectiveUserId }
  })
  if (!existingIngredient) {
    return NextResponse.json({ success: false, error: "Ingredient not found" }, { status: 404 })
  }

  // Build update data - no price change allowed here
  const updateData: { name?: string; categoryId?: string; unit?: string } = {}

  if (name?.trim()) {
    updateData.name = name.trim()
  }

  if (unit?.trim()) {
    updateData.unit = unit.trim()
  }

  if (categoryId) {
    // Verify category belongs to user
    const category = await prisma.ingredientCategory.findFirst({
      where: { id: categoryId, userId: effectiveUserId }
    })
    if (!category) {
      return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 })
    }
    updateData.categoryId = categoryId
  }

  try {
    const updatedIngredient = await prisma.ingredient.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json({ success: true, data: updatedIngredient })
  } catch (error: any) {
    // Route-specific: unique constraint on (name, categoryId, userId)
    if (error.code === 'P2002') {
      return NextResponse.json({ success: false, error: "An ingredient with this name already exists in the selected category" }, { status: 400 })
    }
    throw error
  }
})

export const DELETE = withAuth(async (req: NextRequest, { effectiveUserId }) => {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) {
    return NextResponse.json({ success: false, error: "Ingredient ID is required" }, { status: 400 })
  }

  const ingredient = await prisma.ingredient.findFirst({
    where: { id, userId: effectiveUserId }
  })
  if (!ingredient) {
    return NextResponse.json({ success: false, error: "Ingredient not found" }, { status: 404 })
  }

  await prisma.ingredient.delete({ where: { id } })
  return NextResponse.json({ success: true, message: "Ingredient deleted" })
})

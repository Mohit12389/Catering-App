import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/withAuth" // CHANGED: replaces the repeated auth/dbUser/try-catch preamble

// CHANGED: all four handlers now go through withAuth, which resolves the Clerk
// session, loads the user, derives effectiveUserId (the owner's id for staff) and
// owns the generic 500 catch. Route-specific errors (P2002) stay in the handler.

export const GET = withAuth(
  async (_req, { effectiveUserId }) => {
    const items = await prisma.item.findMany({
      where: { userId: effectiveUserId },
      include: {
        category: { select: { id: true, name: true } },
        itemIngredients: {
          include: {
            ingredient: { select: { id: true, name: true, unit: true, ratePerUnit: true } }
          }
        }
      },
      orderBy: { name: "asc" }
    })

    return NextResponse.json({ success: true, data: items })
  },
  // Preserved exactly: a user with no DB row yet gets an empty SUCCESS list, not
  // a 404, so a brand-new account renders an empty page instead of an error.
  { onMissingUser: () => NextResponse.json({ success: true, data: [] }) }
)

export const POST = withAuth(async (req: NextRequest, { effectiveUserId }) => {
  const { name, categoryId, description } = await req.json()

  if (!name?.trim()) {
    return NextResponse.json({ success: false, error: "Item name is required" }, { status: 400 })
  }
  if (!categoryId) {
    return NextResponse.json({ success: false, error: "Category is required" }, { status: 400 })
  }

  const category = await prisma.itemCategory.findFirst({
    where: { id: categoryId, userId: effectiveUserId }
  })
  if (!category) {
    return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 })
  }

  // CHANGED: the unique rule is case-SENSITIVE in the database, so "Paneer Tikka"
  // and "paneer tikka" were both accepted into the same category. Check ignoring case.
  const duplicateItem = await prisma.item.findFirst({
    where: {
      userId: effectiveUserId,
      categoryId,
      name: { equals: name.trim(), mode: "insensitive" }
    },
    select: { name: true }
  })
  if (duplicateItem) {
    return NextResponse.json(
      { success: false, error: `Item already exists in this category as "${duplicateItem.name}"` },
      { status: 400 }
    )
  }

  try {
    const item = await prisma.item.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        categoryId,
        userId: effectiveUserId
      },
      include: {
        category: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json({ success: true, data: item }, { status: 201 })
  } catch (error: any) {
    // Route-specific: unique constraint on (name, categoryId, userId)
    if (error.code === 'P2002') {
      return NextResponse.json({ success: false, error: "Item already exists in this category" }, { status: 400 })
    }
    throw error
  }
})

// PUT - Update item name and/or category
export const PUT = withAuth(async (req: NextRequest, { effectiveUserId }) => {
  const { id, name, categoryId } = await req.json()

  if (!id) {
    return NextResponse.json({ success: false, error: "Item ID is required" }, { status: 400 })
  }

  // Verify ownership
  const existingItem = await prisma.item.findFirst({
    where: { id, userId: effectiveUserId }
  })
  if (!existingItem) {
    return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 })
  }

  // Build update data
  const updateData: { name?: string; categoryId?: string } = {}

  if (name?.trim()) {
    updateData.name = name.trim()
  }

  if (categoryId) {
    // Verify category belongs to user
    const category = await prisma.itemCategory.findFirst({
      where: { id: categoryId, userId: effectiveUserId }
    })
    if (!category) {
      return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 })
    }
    updateData.categoryId = categoryId
  }

  try {
    const updatedItem = await prisma.item.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json({ success: true, data: updatedItem })
  } catch (error: any) {
    // Route-specific: unique constraint on (name, categoryId, userId)
    if (error.code === 'P2002') {
      return NextResponse.json({ success: false, error: "An item with this name already exists in the selected category" }, { status: 400 })
    }
    throw error
  }
})

export const DELETE = withAuth(async (req: NextRequest, { effectiveUserId }) => {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) {
    return NextResponse.json({ success: false, error: "Item ID is required" }, { status: 400 })
  }

  const item = await prisma.item.findFirst({
    where: { id, userId: effectiveUserId }
  })
  if (!item) {
    return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 })
  }

  await prisma.item.delete({ where: { id } })
  return NextResponse.json({ success: true, message: "Item deleted" })
})

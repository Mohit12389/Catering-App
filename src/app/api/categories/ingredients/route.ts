import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/withAuth"  // CHANGED: replaces the repeated auth/dbUser/try-catch preamble

// CHANGED: all three handlers now go through withAuth, which resolves the Clerk
// session, loads the user, derives effectiveUserId (owner id for staff) and owns
// the generic 500 catch. Route-specific errors (P2002) stay in the handler.

export const GET = withAuth(
  async (_req, { effectiveUserId }) => {
    const categories = await prisma.ingredientCategory.findMany({
      where: { userId: effectiveUserId },
      select: {
        id: true,
        name: true,
        sortOrder: true,
        ingredients: {
          select: {
            id: true,
            name: true,
            unit: true,
            ratePerUnit: true,
            categoryId: true,
            sortOrder: true,
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
        }
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    })

    return NextResponse.json({ success: true, data: categories })
  },
  // Preserved: a user with no DB row yet gets an empty list, not a 404,
  // so a brand-new account renders an empty page instead of an error.
  { onMissingUser: () => NextResponse.json({ success: true, data: [] }) }
)

export const POST = withAuth(async (req: NextRequest, { effectiveUserId }) => {
  const { name } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ success: false, error: "Category name is required" }, { status: 400 })
  }

  // CHANGED: the database's unique rule is case-SENSITIVE, so "Chaat Stalls" and
  // "chaat Stalls" were both accepted as separate categories. Check for an existing
  // name ignoring case before creating.
  const duplicate = await prisma.ingredientCategory.findFirst({
    where: { userId: effectiveUserId, name: { equals: name.trim(), mode: "insensitive" } },
    select: { name: true }
  })
  if (duplicate) {
    return NextResponse.json(
      { success: false, error: `Category already exists as "${duplicate.name}"` },
      { status: 400 }
    )
  }

  try {
    // New categories get sortOrder 0 (lowest priority / end of list)
    const category = await prisma.ingredientCategory.create({
      data: { name: name.trim(), userId: effectiveUserId, sortOrder: 0 },
      select: { id: true, name: true, sortOrder: true }
    })
    return NextResponse.json({ success: true, data: { ...category, ingredients: [] } }, { status: 201 })
  } catch (error: any) {
    // Route-specific: unique constraint on (name, userId)
    if (error.code === "P2002") {
      return NextResponse.json({ success: false, error: "Category already exists" }, { status: 400 })
    }
    throw error
  }
})

export const DELETE = withAuth(async (req: NextRequest, { effectiveUserId }) => {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) {
    return NextResponse.json({ success: false, error: "Category ID is required" }, { status: 400 })
  }

  const category = await prisma.ingredientCategory.findFirst({ where: { id, userId: effectiveUserId } })
  if (!category) {
    return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 })
  }

  await prisma.ingredientCategory.delete({ where: { id } })
  return NextResponse.json({ success: true, message: "Category deleted" })
})

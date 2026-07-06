import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { getEffectiveUserId } from "@/lib/getEffectiveUserId"

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!dbUser) {
      return NextResponse.json({ success: true, data: [] })
    }

    const items = await prisma.item.findMany({
      where: { userId: getEffectiveUserId(dbUser) },
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
  } catch (error) {
    console.error("Error fetching items:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch items" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const { name, categoryId, description } = await req.json()

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: "Item name is required" }, { status: 400 })
    }
    if (!categoryId) {
      return NextResponse.json({ success: false, error: "Category is required" }, { status: 400 })
    }

    const category = await prisma.itemCategory.findFirst({
      where: { id: categoryId, userId: getEffectiveUserId(dbUser) }
    })
    if (!category) {
      return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 })
    }

    const item = await prisma.item.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        categoryId,
        userId: getEffectiveUserId(dbUser)
      },
      include: {
        category: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json({ success: true, data: item }, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ success: false, error: "Item already exists in this category" }, { status: 400 })
    }
    console.error("Error creating item:", error)
    return NextResponse.json({ success: false, error: "Failed to create item" }, { status: 500 })
  }
}

// PUT - Update item name and/or category
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

    const { id, name, categoryId } = await req.json()

    if (!id) {
      return NextResponse.json({ success: false, error: "Item ID is required" }, { status: 400 })
    }

    // Verify ownership
    const existingItem = await prisma.item.findFirst({
      where: { id, userId: getEffectiveUserId(dbUser)}
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
        where: { id: categoryId, userId: getEffectiveUserId(dbUser) }
      })
      if (!category) {
        return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 })
      }
      updateData.categoryId = categoryId
    }

    const updatedItem = await prisma.item.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json({ success: true, data: updatedItem })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ success: false, error: "An item with this name already exists in the selected category" }, { status: 400 })
    }
    console.error("Error updating item:", error)
    return NextResponse.json({ success: false, error: "Failed to update item" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ success: false, error: "Item ID is required" }, { status: 400 })
    }

    const item = await prisma.item.findFirst({
      where: { id, userId: getEffectiveUserId(dbUser) }
    })
    if (!item) {
      return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 })
    }

    await prisma.item.delete({ where: { id } })
    return NextResponse.json({ success: true, message: "Item deleted" })
  } catch (error) {
    console.error("Error deleting item:", error)
    return NextResponse.json({ success: false, error: "Failed to delete item" }, { status: 500 })
  }
}
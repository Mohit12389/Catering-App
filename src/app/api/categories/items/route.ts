import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Get database user
    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!dbUser) {
      return NextResponse.json({ success: false, data: [] })
    }

    const categories = await prisma.itemCategory.findMany({
      where: { userId: dbUser.id },
      select: {
        id: true,
        name: true,
        items: {
          select: {
            id: true,
            name: true,
            description: true,
            categoryId: true,
            itemIngredients: {
              select: { id: true }
            }
          },
          orderBy: { name: "asc" }
        }
      },
      orderBy: { name: "asc" }
    })

    return NextResponse.json({ success: true, data: categories })
  } catch (error) {
    console.error("Error fetching item categories:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch categories" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Get database user
    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const { name } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: "Category name is required" }, { status: 400 })
    }

    const category = await prisma.itemCategory.create({
      data: { 
        name: name.trim(),
        userId: dbUser.id
      },
      select: { id: true, name: true }
    })

    return NextResponse.json({ success: true, data: { ...category, items: [] } }, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ success: false, error: "Category already exists" }, { status: 400 })
    }
    console.error("Error creating item category:", error)
    return NextResponse.json({ success: false, error: "Failed to create category" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Get database user
    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ success: false, error: "Category ID is required" }, { status: 400 })
    }

    // Verify ownership
    const category = await prisma.itemCategory.findFirst({
      where: { id, userId: dbUser.id }
    })
    if (!category) {
      return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 })
    }

    await prisma.itemCategory.delete({ where: { id } })
    return NextResponse.json({ success: true, message: "Category deleted" })
  } catch (error) {
    console.error("Error deleting item category:", error)
    return NextResponse.json({ success: false, error: "Failed to delete category" }, { status: 500 })
  }
}

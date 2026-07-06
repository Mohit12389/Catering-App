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

    const categories = await prisma.ingredientCategory.findMany({
      where: { userId: getEffectiveUserId(dbUser)},
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
  } catch (error) {
    console.error("Error fetching ingredient categories:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch categories" }, { status: 500 })
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

    const { name } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: "Category name is required" }, { status: 400 })
    }

    // New categories get sortOrder 0 (lowest priority / end of list)
    const category = await prisma.ingredientCategory.create({
      data: { 
        name: name.trim(),
        userId: getEffectiveUserId(dbUser),
        sortOrder: 0
      },
      select: { id: true, name: true, sortOrder: true }
    })

    return NextResponse.json({ success: true, data: { ...category, ingredients: [] } }, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ success: false, error: "Category already exists" }, { status: 400 })
    }
    console.error("Error creating ingredient category:", error)
    return NextResponse.json({ success: false, error: "Failed to create category" }, { status: 500 })
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
      return NextResponse.json({ success: false, error: "Category ID is required" }, { status: 400 })
    }

    const category = await prisma.ingredientCategory.findFirst({
      where: { id, userId: getEffectiveUserId(dbUser) }
    })
    if (!category) {
      return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 })
    }

    await prisma.ingredientCategory.delete({ where: { id } })
    return NextResponse.json({ success: true, message: "Category deleted" })
  } catch (error) {
    console.error("Error deleting ingredient category:", error)
    return NextResponse.json({ success: false, error: "Failed to delete category" }, { status: 500 })
  }
}
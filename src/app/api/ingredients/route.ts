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

    const ingredients = await prisma.ingredient.findMany({
      where: { userId: getEffectiveUserId(dbUser) },
      include: {
        category: { select: { id: true, name: true } }
      },
      orderBy: { name: "asc" }
    })

    return NextResponse.json({ success: true, data: ingredients })
  } catch (error) {
    console.error("Error fetching ingredients:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch ingredients" }, { status: 500 })
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
      where: { id: categoryId, userId: getEffectiveUserId(dbUser)}
    })
    if (!category) {
      return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 })
    }

    const ingredient = await prisma.ingredient.create({
      data: {
        name: name.trim(),
        unit: unit.trim(),
        ratePerUnit: parseFloat(ratePerUnit) || 0,
        categoryId,
        userId: getEffectiveUserId(dbUser)
      },
      include: {
        category: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json({ success: true, data: ingredient }, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ success: false, error: "Ingredient already exists in this category" }, { status: 400 })
    }
    console.error("Error creating ingredient:", error)
    return NextResponse.json({ success: false, error: "Failed to create ingredient" }, { status: 500 })
  }
}

// PUT - Update ingredient name, category, and/or unit (NOT price)
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

    const { id, name, categoryId, unit } = await req.json()

    if (!id) {
      return NextResponse.json({ success: false, error: "Ingredient ID is required" }, { status: 400 })
    }

    // Verify ownership
    const existingIngredient = await prisma.ingredient.findFirst({
      where: { id, userId: getEffectiveUserId(dbUser)}
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
        where: { id: categoryId, userId: getEffectiveUserId(dbUser)}
      })
      if (!category) {
        return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 })
      }
      updateData.categoryId = categoryId
    }

    const updatedIngredient = await prisma.ingredient.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json({ success: true, data: updatedIngredient })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ success: false, error: "An ingredient with this name already exists in the selected category" }, { status: 400 })
    }
    console.error("Error updating ingredient:", error)
    return NextResponse.json({ success: false, error: "Failed to update ingredient" }, { status: 500 })
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
      return NextResponse.json({ success: false, error: "Ingredient ID is required" }, { status: 400 })
    }

    const ingredient = await prisma.ingredient.findFirst({
      where: { id, userId: getEffectiveUserId(dbUser) }
    })
    if (!ingredient) {
      return NextResponse.json({ success: false, error: "Ingredient not found" }, { status: 404 })
    }

    await prisma.ingredient.delete({ where: { id } })
    return NextResponse.json({ success: true, message: "Ingredient deleted" })
  } catch (error) {
    console.error("Error deleting ingredient:", error)
    return NextResponse.json({ success: false, error: "Failed to delete ingredient" }, { status: 500 })
  }
}
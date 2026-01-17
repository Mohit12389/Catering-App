import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

// POST - One-time fix to set priceAtEvent for existing events that have null
// This should be run ONCE to fix historical data
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true }
    })
    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Find all event ingredients with null priceAtEvent for this user's events
    const eventIngredientsToFix = await prisma.eventIngredient.findMany({
      where: {
        priceAtEvent: null,
        event: {
          userId: dbUser.id
        }
      },
      select: {
        id: true,
        ingredientId: true,
        ingredient: {
          select: {
            ratePerUnit: true
          }
        }
      }
    })

    console.log(`Found ${eventIngredientsToFix.length} event ingredients with null priceAtEvent`)

    // Update each one with the current ratePerUnit
    let updatedCount = 0
    for (const ei of eventIngredientsToFix) {
      await prisma.eventIngredient.update({
        where: { id: ei.id },
        data: {
          priceAtEvent: ei.ingredient?.ratePerUnit || 0
        }
      })
      updatedCount++
    }

    return NextResponse.json({
      success: true,
      message: `Fixed ${updatedCount} event ingredients. They now have priceAtEvent set.`
    })
  } catch (error) {
    console.error("Error fixing prices:", error)
    return NextResponse.json({ success: false, error: "Failed to fix prices" }, { status: 500 })
  }
}

// GET - Check how many event ingredients have null priceAtEvent
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true }
    })
    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const count = await prisma.eventIngredient.count({
      where: {
        priceAtEvent: null,
        event: {
          userId: dbUser.id
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        nullPriceAtEventCount: count,
        message: count > 0 
          ? `${count} event ingredients need fixing. Call POST to fix them.`
          : "All event ingredients have priceAtEvent set!"
      }
    })
  } catch (error) {
    console.error("Error checking:", error)
    return NextResponse.json({ success: false, error: "Failed to check" }, { status: 500 })
  }
}
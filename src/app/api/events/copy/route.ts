import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { generateEventId } from "@/lib/utils"
import { getEffectiveUserId } from "@/lib/getEffectiveUserId"

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({ 
      where: { clerkId: userId },
      select: { id: true, role: true, ownerId: true }
    })
    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const body = await req.json()
    const {
      sourceEventId,
      organizerName,
      phoneNumber,
      homeAddress,
      location,
      selectedMeals
    } = body

    if (!sourceEventId || !organizerName || !phoneNumber) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
    }

    if (!selectedMeals || !Array.isArray(selectedMeals) || selectedMeals.length === 0) {
      return NextResponse.json({ success: false, error: "Select at least one meal to copy" }, { status: 400 })
    }

    for (const meal of selectedMeals) {
      if (!meal.newMealType || !meal.newDate) {
        return NextResponse.json({ success: false, error: "Each meal needs a type and date" }, { status: 400 })
      }
    }

    // Fetch source event with items and ingredients
    const sourceEvent = await prisma.event.findUnique({
      where: { id: sourceEventId },
      include: {
        eventItems: {
          include: {
            item: {
              include: { itemIngredients: true }
            }
          }
        },
        eventIngredients: {
          include: { ingredient: true }
        },
        eventCategorySettings: true
      }
    })

    if (!sourceEvent) {
      return NextResponse.json({ success: false, error: "Source event not found" }, { status: 404 })
    }

    // =============================================
    // Filter items by selected meals only
    // =============================================

    const selectedMealKeys = new Set(
      selectedMeals.map((m: any) => `${m.originalLabel}::${m.originalDate || ""}`)
    )

    const mealUpdateMap = new Map<string, any>()
    for (const m of selectedMeals) {
      const key = `${m.originalLabel}::${m.originalDate || ""}`
      mealUpdateMap.set(key, m)
    }

    const selectedItems: typeof sourceEvent.eventItems = []
    const unselectedItems: typeof sourceEvent.eventItems = []

    for (const ei of sourceEvent.eventItems) {
      const label = ei.mealLabel || "default"
      const dateStr = ei.mealDate ? ei.mealDate.toISOString().split("T")[0] : ""
      const key = `${label}::${dateStr}`

      if (selectedMealKeys.has(key)) {
        selectedItems.push(ei)
      } else {
        unselectedItems.push(ei)
      }
    }

    // =============================================
    // Determine shared ingredients
    // =============================================

    const selectedIngredientIds = new Set<string>()
    selectedItems.forEach(ei => {
      ei.item.itemIngredients.forEach(ii => {
        selectedIngredientIds.add(ii.ingredientId)
      })
    })

    const unselectedIngredientIds = new Set<string>()
    unselectedItems.forEach(ei => {
      ei.item.itemIngredients.forEach(ii => {
        unselectedIngredientIds.add(ii.ingredientId)
      })
    })

    // Shared = in both sets (need quantity review)
    const sharedIngredientIds = new Set<string>()
    selectedIngredientIds.forEach(id => {
      if (unselectedIngredientIds.has(id)) {
        sharedIngredientIds.add(id)
      }
    })

    // =============================================
    // Calculate total amount
    // =============================================

    const totalAmount = selectedMeals.reduce((sum: number, m: any) => {
      return sum + ((parseInt(m.newGuests) || 0) * (parseFloat(m.newPerPlate) || 0))
    }, 0)

    const firstMeal = selectedMeals[0]

    // =============================================
    // Create new event
    // =============================================

    const eventItemsData = selectedItems.map(ei => {
      const label = ei.mealLabel || "default"
      const dateStr = ei.mealDate ? ei.mealDate.toISOString().split("T")[0] : ""
      const key = `${label}::${dateStr}`
      const newMeal = mealUpdateMap.get(key)

      return {
        itemId: ei.itemId,
        mealLabel: newMeal?.newMealType || ei.mealLabel,
        mealDate: newMeal?.newDate ? new Date(newMeal.newDate) : ei.mealDate,
        mealGuests: newMeal?.newGuests ? parseInt(newMeal.newGuests) : ei.mealGuests,
        mealPerPlate: newMeal?.newPerPlate ? parseFloat(newMeal.newPerPlate) : ei.mealPerPlate
      }
    })

    // CHANGED: Use status:"shared" instead of modifying notes
    const eventIngredientsData = sourceEvent.eventIngredients
      .filter(ei => selectedIngredientIds.has(ei.ingredientId))
      .map(ei => ({
        ingredientId: ei.ingredientId,
        quantity: ei.quantity,
        priceAtEvent: ei.ingredient.ratePerUnit,
        notes: ei.notes || null,  // CHANGED: Preserve original notes, don't pollute
        status: sharedIngredientIds.has(ei.ingredientId) ? "shared" : "normal"  // CHANGED: Mark shared via status
      }))

    const newEvent = await prisma.event.create({
      data: {
        eventId: generateEventId(),
        organizerName,
        phoneNumber,
        location: location || sourceEvent.location,
        homeAddress: homeAddress || sourceEvent.homeAddress || null,
        bookingDate: new Date(),
        functionDate: new Date(firstMeal.newDate),
        functionTime: firstMeal.newMealType,
        menuCreationDate: new Date(),
        guestCount: parseInt(firstMeal.newGuests) || sourceEvent.guestCount,
        perPlatePrice: parseFloat(firstMeal.newPerPlate) || 0,
        totalAmount,
        advancePayment: 0,
        status: "active",
        userId: getEffectiveUserId(dbUser),
        eventItems: { create: eventItemsData },
        eventIngredients: { create: eventIngredientsData },
        eventCategorySettings: {
          create: sourceEvent.eventCategorySettings.map(cs => ({
            ingredientCategoryId: cs.ingredientCategoryId,
            boughtBy: cs.boughtBy
          }))
        }
      },
      select: {
        id: true,
        eventId: true,
        organizerName: true
      }
    })

    return NextResponse.json({ success: true, data: newEvent }, { status: 201 })
  } catch (error) {
    console.error("Error copying event:", error)
    return NextResponse.json({ success: false, error: "Failed to copy event" }, { status: 500 })
  }
}
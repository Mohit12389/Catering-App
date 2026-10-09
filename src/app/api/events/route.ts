import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateEventId } from "@/lib/utils"
import { earliestMealDate } from "@/lib/eventRules" // CHANGED: shared functionDate rule (latestMealDate moved to lib/eventList with the GET body)
import { listEvents } from "@/lib/eventList" // CHANGED: GET body lives here now (also used by the Event History server page)
import { withAuth } from "@/lib/withAuth" // CHANGED: replaces the repeated auth/dbUser/try-catch preamble

export const GET = withAuth(async (req: NextRequest, { dbUser, effectiveUserId }) => {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")

    // CHANGED: the list-building body moved to lib/eventList.ts (shared with the server-
    // rendered Event History page). Same query, same staff stripping, same rows.
    const transformed = await listEvents({ effectiveUserId, role: dbUser.role, status })

    return NextResponse.json({ success: true, data: transformed })
})

// CHANGED: the shape of one meal as the create-event form sends it (was `any`).
// Numbers may arrive as strings from <input> fields, hence string | number.
interface MealInput {
  mealType?: string | null
  mealDate?: string | null
  selectedItems?: string[]
  guestCount?: string | number | null
  perPlatePrice?: string | number | null
  mealNotes?: string | null
}

export const POST = withAuth(async (req: NextRequest, { effectiveUserId }) => {
    const body = await req.json()
    const { organizerName, phoneNumber, location, homeAddress, functionDate, functionTime,
            menuCreationDate, guestCount, totalAmount, notes, meals } = body

    if (!organizerName || !phoneNumber || !location || !functionDate || !functionTime) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
    }
    if (!meals || !Array.isArray(meals) || meals.length === 0) {
      return NextResponse.json({ success: false, error: "At least one meal is required" }, { status: 400 })
    }

    // CHANGED: functionDate is the EARLIEST meal date, via the shared rule. The old
    // inline sort called new Date(m.mealDate) on every entry, so one missing date made
    // the comparator return NaN and the "earliest" meal was whichever order survived.
    // A dateless set now fails with a 400 instead of writing an Invalid Date.
    const functionDateValue = earliestMealDate((meals as MealInput[]).map(m => m.mealDate)) // CHANGED: typed
    if (!functionDateValue) {
      return NextResponse.json({ success: false, error: "Each meal needs a date" }, { status: 400 })
    }

    // Collect all item IDs to get their ingredients
    const allItemIds = Array.from(new Set((meals as MealInput[]).flatMap(m => m.selectedItems || []))) // CHANGED: typed

    const itemsWithIngredients = await prisma.item.findMany({
      where: { id: { in: allItemIds } },
      select: {
        id: true,
        itemIngredients: {
          select: { ingredientId: true, ingredient: { select: { id: true, ratePerUnit: true } } }
        }
      }
    })

    const ingredientPriceMap = new Map<string, number>()
    itemsWithIngredients.forEach(item => {
      item.itemIngredients.forEach(ii => {
        if (!ingredientPriceMap.has(ii.ingredientId)) {
          ingredientPriceMap.set(ii.ingredientId, ii.ingredient?.ratePerUnit || 0)
        }
      })
    })

    // Build EventItem rows — each item tagged with its meal label
    // CHANGED: typed (was any[] / any)
    const eventItemsData: {
      itemId: string; mealLabel: string | null; mealDate: Date | null
      mealGuests: number | null; mealPerPlate: number | null; mealNotes: string | null
    }[] = []
    ;(meals as MealInput[]).forEach(meal => {
      (meal.selectedItems || []).forEach((itemId: string) => {
        eventItemsData.push({
          itemId,
          mealLabel: meal.mealType || null,
          mealDate: meal.mealDate ? new Date(meal.mealDate) : null,
          mealGuests: parseInt(String(meal.guestCount)) || null,       // CHANGED: String() — same result for string or number
          mealPerPlate: parseFloat(String(meal.perPlatePrice)) || null,
          mealNotes: String(meal.mealNotes ?? "").trim() || null  // CHANGED: per-meal note
        })
      })
    })

    const event = await prisma.event.create({
      data: {
        eventId: generateEventId(),
        organizerName,
        phoneNumber,
        location,
        homeAddress: homeAddress || null,
        bookingDate: new Date(),
        functionDate: functionDateValue,
        functionTime,
        menuCreationDate: menuCreationDate ? new Date(menuCreationDate) : new Date(),
        guestCount: parseInt(guestCount) || 0,
        perPlatePrice: 0,
        totalAmount: parseFloat(totalAmount) || 0,
        advancePayment: 0,
        notes: notes || null,
        userId: effectiveUserId,
        eventItems: { create: eventItemsData },
        eventIngredients: {
          create: Array.from(ingredientPriceMap.entries()).map(([ingredientId, price]) => ({
            ingredientId, quantity: 0, priceAtEvent: price
          }))
        }
      },
      select: { id: true, eventId: true, organizerName: true }
    })

    return NextResponse.json({ success: true, data: event }, { status: 201 })
})

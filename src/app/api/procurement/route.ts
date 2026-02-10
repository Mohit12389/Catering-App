import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

// GET - Fetch procurement data by date range
// Query params: startDate, endDate, categoryId (optional)
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

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const categoryId = searchParams.get("categoryId")

    if (!startDate || !endDate) {
      return NextResponse.json({
        success: false,
        error: "startDate and endDate are required"
      }, { status: 400 })
    }

    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    // 1. Fetch events in date range with their ingredients
    const events = await prisma.event.findMany({
      where: {
        userId: dbUser.id,
        functionDate: {
          gte: start,
          lte: end
        }
      },
      select: {
        id: true,
        eventId: true,
        organizerName: true,
        phoneNumber: true,
        location: true,
        functionDate: true,
        guestCount: true,
        eventIngredients: {
          where: {
            status: { not: "removed" }
          },
          select: {
            id: true,
            quantity: true,
            priceAtEvent: true,
            ingredient: {
              select: {
                id: true,
                name: true,
                unit: true,
                ratePerUnit: true,
                categoryId: true,
                category: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        },
        eventCategorySettings: {
          select: {
            ingredientCategoryId: true,
            boughtBy: true
          }
        }
      },
      orderBy: { functionDate: "asc" }
    })

    // 2. Fetch existing category payments for these events
    // Wrapped in try-catch so it works even before running db push
    const paymentMap: Record<string, {
      id: string
      paidAt: string
      notes: string | null
    }> = {}

    try {
      const eventIds = events.map((e: { id: string }) => e.id)
      if (eventIds.length > 0) {
        const payments = await prisma.categoryPayment.findMany({
          where: {
            eventId: { in: eventIds },
            userId: dbUser.id
          },
          select: {
            id: true,
            eventId: true,
            ingredientCategoryId: true,
            paidAt: true,
            notes: true
          }
        })

        for (const p of payments) {
          const key = `${p.eventId}__${p.ingredientCategoryId}`
          paymentMap[key] = {
            id: p.id,
            paidAt: p.paidAt.toISOString(),
            notes: p.notes
          }
        }
      }
    } catch (err) {
      // CategoryPayment table might not exist yet - that's ok, payments will show as unpaid
      console.log("CategoryPayment table not available yet - skipping payment status")
    }

    // 3. Get all ingredient categories for this user
    const allCategories = await prisma.ingredientCategory.findMany({
      where: { userId: dbUser.id },
      orderBy: { name: "asc" }
    })

    // 4. Build category-level cost breakdown
    interface EventEntry {
      eventId: string
      eventDbId: string
      organizerName: string
      functionDate: string
      location: string
      guestCount: number
      categoryCost: number
      boughtBy: string
      isPaid: boolean
      paymentId?: string
      paymentDate?: string
      paymentNotes?: string
    }

    interface IngredientPerEvent {
      eventId: string
      eventDbId: string
      organizerName: string
      functionDate: string
      quantity: number
      pricePerUnit: number
      cost: number
    }

    interface IngredientEntry {
      ingredientId: string
      name: string
      unit: string
      totalQuantity: number
      totalCost: number
      perEvent: IngredientPerEvent[]
    }

    interface CategoryEntry {
      categoryId: string
      categoryName: string
      totalCost: number
      events: EventEntry[]
      ingredients: Record<string, IngredientEntry>
    }

    const categoryMap: Record<string, CategoryEntry> = {}

    for (const event of events) {
      for (const ei of event.eventIngredients) {
        const ingredient = ei.ingredient
        if (!ingredient || !ingredient.category) continue

        const catId = ingredient.category.id
        const catName = ingredient.category.name

        // Skip if filtering by specific category
        if (categoryId && catId !== categoryId) continue

        // Check boughtBy setting
        const categorySetting = event.eventCategorySettings.find(
          (s: { ingredientCategoryId: string; boughtBy: string }) => s.ingredientCategoryId === catId
        )
        const boughtBy = categorySetting?.boughtBy || "caterer"

        // Price calculation
        const pricePerUnit = ei.priceAtEvent ?? ingredient.ratePerUnit ?? 0
        const cost = ei.quantity * pricePerUnit

        // Initialize category
        if (!categoryMap[catId]) {
          categoryMap[catId] = {
            categoryId: catId,
            categoryName: catName,
            totalCost: 0,
            events: [],
            ingredients: {}
          }
        }

        const cat = categoryMap[catId]

        // Add or find event entry for this category
        let eventEntry = cat.events.find((e: EventEntry) => e.eventDbId === event.id)
        if (!eventEntry) {
          const paymentKey = `${event.id}__${catId}`
          const payment = paymentMap[paymentKey]

          eventEntry = {
            eventId: event.eventId,
            eventDbId: event.id,
            organizerName: event.organizerName,
            functionDate: event.functionDate.toISOString(),
            location: event.location,
            guestCount: event.guestCount,
            categoryCost: 0,
            boughtBy,
            isPaid: !!payment,
            paymentId: payment?.id,
            paymentDate: payment?.paidAt,
            paymentNotes: payment?.notes || undefined
          }
          cat.events.push(eventEntry)
        }

        eventEntry.categoryCost += cost

        // Add or find ingredient entry
        if (!cat.ingredients[ingredient.id]) {
          cat.ingredients[ingredient.id] = {
            ingredientId: ingredient.id,
            name: ingredient.name,
            unit: ingredient.unit,
            totalQuantity: 0,
            totalCost: 0,
            perEvent: []
          }
        }

        const ing = cat.ingredients[ingredient.id]
        ing.totalQuantity += ei.quantity
        ing.totalCost += cost
        ing.perEvent.push({
          eventId: event.eventId,
          eventDbId: event.id,
          organizerName: event.organizerName,
          functionDate: event.functionDate.toISOString(),
          quantity: ei.quantity,
          pricePerUnit,
          cost
        })

        cat.totalCost += cost
      }
    }

    // 5. Convert to arrays and build response
    const categories = Object.values(categoryMap)
      .map((cat: CategoryEntry) => ({
        ...cat,
        ingredients: Object.values(cat.ingredients).sort(
          (a: IngredientEntry, b: IngredientEntry) => b.totalCost - a.totalCost
        )
      }))
      .sort((a, b) => b.totalCost - a.totalCost)

    const grandTotal = categories.reduce((sum: number, c) => sum + c.totalCost, 0)

    const pieChartData = categories.map((cat) => ({
      categoryId: cat.categoryId,
      categoryName: cat.categoryName,
      totalCost: cat.totalCost,
      percentage: grandTotal > 0 ? ((cat.totalCost / grandTotal) * 100) : 0,
      eventCount: cat.events.length,
      ingredientCount: cat.ingredients.length
    }))

    const totalPaid = categories.reduce((sum: number, cat) => {
      return sum + cat.events
        .filter((e: EventEntry) => e.isPaid)
        .reduce((s: number, e: EventEntry) => s + e.categoryCost, 0)
    }, 0)
    const totalUnpaid = grandTotal - totalPaid

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          grandTotal,
          totalPaid,
          totalUnpaid,
          totalEvents: events.length,
          totalCategories: categories.length,
          dateRange: { start: start.toISOString(), end: end.toISOString() }
        },
        pieChartData,
        categories,
        allCategories: allCategories.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))
      }
    })
  } catch (error) {
    console.error("Error fetching procurement data:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch procurement data" }, { status: 500 })
  }
}
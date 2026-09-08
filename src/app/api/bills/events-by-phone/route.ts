import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { mealKey } from "@/lib/meals"  // CHANGED: shared composite meal key
import { withAuth } from "@/lib/withAuth" // CHANGED: replaces the repeated auth/user-lookup/403/try-catch preamble

// CHANGED: withAuth resolves the session, loads the user, derives effectiveUserId
// and — via { ownerOnly: true } — returns the 403 that each handler used to write
// by hand. Staff access is unchanged; it is now declared rather than remembered.
export const GET = withAuth(async (req: NextRequest, { effectiveUserId }) => {
    const { searchParams } = new URL(req.url)
    const phoneNumber = searchParams.get("phoneNumber")
    if (!phoneNumber) {
      return NextResponse.json({ success: false, error: "Phone number required" }, { status: 400 })
    }

    const events = await prisma.event.findMany({
      where: {
        userId: effectiveUserId,
        phoneNumber: { contains: phoneNumber }
      },
      select: {
        id: true,
        eventId: true,
        organizerName: true,
        phoneNumber: true,
        location: true,
        functionDate: true,
        functionTime: true,
        guestCount: true,
        perPlatePrice: true,
        totalAmount: true,
        advancePayment: true,
        status: true,
        advancePayments: {
          select: { id: true, amount: true, paidDate: true, notes: true },
          orderBy: { paidDate: "asc" }
        },
        // Include eventItems to build mealGroups
        eventItems: {
          select: {
            mealLabel: true,
            mealDate: true,
            mealGuests: true,
            mealPerPlate: true
          }
        }
      },
      orderBy: { functionDate: "desc" }
    })

    const eventsWithCost = await Promise.all(events.map(async (event) => {
      const categorySettings = await prisma.eventCategorySetting.findMany({
        where: { eventId: event.id },
        select: { ingredientCategoryId: true, boughtBy: true }
      })

      const categoryBoughtByMap: Record<string, string> = {}
      for (const setting of categorySettings) {
        categoryBoughtByMap[setting.ingredientCategoryId] = setting.boughtBy
      }

      const eventIngredients = await prisma.eventIngredient.findMany({
        where: { eventId: event.id },
        select: {
          quantity: true,
          priceAtEvent: true,
          ingredient: {
            select: { categoryId: true, ratePerUnit: true }
          }
        }
      })

      let catererCost = 0
      let clientCost = 0
      for (const ei of eventIngredients) {
        const categoryId = ei.ingredient?.categoryId
        const unitPrice = ei.priceAtEvent ?? ei.ingredient?.ratePerUnit ?? 0
        const itemCost = ei.quantity * unitPrice
        const boughtBy = categoryId ? (categoryBoughtByMap[categoryId] || "caterer") : "caterer"
        if (boughtBy === "client") {
          clientCost += itemCost
        } else {
          catererCost += itemCost
        }
      }

      // Build mealGroups from eventItems
      const mealGroupsMap: Record<string, { label: string; date: string | null; guests: number; perPlate: number }> = {}
      event.eventItems.forEach(ei => {
        const label = ei.mealLabel || "default"
        const key = mealKey(ei.mealLabel, ei.mealDate)  // CHANGED: shared composite key
        if (!mealGroupsMap[key]) {
          mealGroupsMap[key] = {
            label,
            date: ei.mealDate ? String(ei.mealDate) : null,
            guests: ei.mealGuests || 0,
            perPlate: ei.mealPerPlate || 0
          }
        }
      })

      // Remove eventItems from response (not needed by billing page)
      const { eventItems, ...eventWithoutItems } = event

      return {
        ...eventWithoutItems,
        catererCost: Math.round(catererCost * 100) / 100,
        clientCost: Math.round(clientCost * 100) / 100,
        mealGroups: Object.values(mealGroupsMap)
      }
    }))

    return NextResponse.json({ success: true, data: eventsWithCost })
}, { ownerOnly: true })

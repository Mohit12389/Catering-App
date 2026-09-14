import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { mealKey } from "@/lib/meals"  // CHANGED: shared composite meal key
import { withAuth } from "@/lib/withAuth" // CHANGED: replaces the repeated auth/user-lookup/403/try-catch preamble
import { latestMealDate } from "@/lib/eventRules" // CHANGED: last sub-event date decides whether an event has happened
import { balanceOf, paymentStatusOf } from "@/lib/paymentStatus" // CHANGED: derived, never stored
import { billingByEvent } from "@/lib/eventBilling" // CHANGED: one place that answers "is it billed, and for how much"

// CHANGED: withAuth resolves the session, loads the user, derives effectiveUserId
// and — via { ownerOnly: true } — returns the 403 that each handler used to write
// by hand. Staff access is unchanged; it is now declared rather than remembered.
export const GET = withAuth(async (req: NextRequest, { effectiveUserId }) => {
    const { searchParams } = new URL(req.url)
    const phoneNumber = searchParams.get("phoneNumber")
    // CHANGED: also addressable by explicit event ids, so the bill composer can be opened
    // straight from the history page with the events already chosen — instead of the
    // operator retyping the phone number of the customer whose row he is looking at.
    const ids = (searchParams.get("ids") || "").split(",").map(s => s.trim()).filter(Boolean)

    if (!phoneNumber && ids.length === 0) {
      return NextResponse.json({ success: false, error: "Phone number or ids required" }, { status: 400 })
    }

    const events = await prisma.event.findMany({
      where: {
        userId: effectiveUserId,
        ...(ids.length > 0 ? { id: { in: ids } } : { phoneNumber: { contains: phoneNumber as string } })
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

    // CHANGED: this ran TWO queries per event inside Promise.all — the settings and the
    // ingredients — so a customer with ten events cost twenty round-trips. Both are now
    // fetched once for every event and grouped in memory.
    const eventIds = events.map(e => e.id)

    const allSettings = eventIds.length
      ? await prisma.eventCategorySetting.findMany({
          where: { eventId: { in: eventIds } },
          select: { eventId: true, ingredientCategoryId: true, boughtBy: true }
        })
      : []
    const settingsByEvent = new Map<string, Record<string, string>>()
    for (const setting of allSettings) {
      const forEvent = settingsByEvent.get(setting.eventId) ?? {}
      forEvent[setting.ingredientCategoryId] = setting.boughtBy
      settingsByEvent.set(setting.eventId, forEvent)
    }

    const allIngredients = eventIds.length
      ? await prisma.eventIngredient.findMany({
          where: { eventId: { in: eventIds } },
          select: {
            eventId: true,
            quantity: true,
            priceAtEvent: true,
            ingredient: {
              select: { categoryId: true, ratePerUnit: true }
            }
          }
        })
      : []
    const ingredientsByEvent = new Map<string, typeof allIngredients>()
    for (const ei of allIngredients) {
      const forEvent = ingredientsByEvent.get(ei.eventId) ?? []
      forEvent.push(ei)
      ingredientsByEvent.set(ei.eventId, forEvent)
    }

    // CHANGED: which of these events are already on a bill. The picker used to give no
    // hint, so billing the same event twice was a silent accident; now the already-billed
    // ones are labelled and the composer can default to the unsettled ones.
    const billedByEvent = await billingByEvent(eventIds, effectiveUserId)

    const eventsWithCost = events.map((event) => {
      const categoryBoughtByMap = settingsByEvent.get(event.id) ?? {}
      const eventIngredients = ingredientsByEvent.get(event.id) ?? []

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
        mealGroups: Object.values(mealGroupsMap),
        lastMealDate: latestMealDate(event.eventItems.map(ei => ei.mealDate)),
        billedAs: billedByEvent.get(event.id) || null,
        // Billed events owe what the bill says, discount and tax included.
        receivable: billedByEvent.get(event.id)?.amount ?? event.totalAmount,
        paymentStatus: paymentStatusOf(
          event.advancePayment || 0,
          billedByEvent.get(event.id)?.amount ?? event.totalAmount
        ),
        balance: balanceOf(
          event.advancePayment || 0,
          billedByEvent.get(event.id)?.amount ?? event.totalAmount
        )
      }
    })

    return NextResponse.json({ success: true, data: eventsWithCost })
}, { ownerOnly: true })

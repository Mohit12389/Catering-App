import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateEventId } from "@/lib/utils"
import { mealKey } from "@/lib/meals" // CHANGED: shared composite meal key
import { earliestMealDate, latestMealDate } from "@/lib/eventRules" // CHANGED: shared functionDate rule + the last-meal date the Done stage needs
import { billingByEvent } from "@/lib/eventBilling" // CHANGED: one place that answers "is it billed, and for how much"
import { withAuth } from "@/lib/withAuth" // CHANGED: replaces the repeated auth/dbUser/try-catch preamble

export const GET = withAuth(async (req: NextRequest, { dbUser, effectiveUserId }) => {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")

    const events = await prisma.event.findMany({
      where: {
        userId: effectiveUserId,
        ...(status && { status })
      },
      select: {
        id: true, eventId: true, organizerName: true, phoneNumber: true,
        location: true, homeAddress: true, bookingDate: true, functionDate: true, functionTime: true,
        menuCreationDate: true, guestCount: true, perPlatePrice: true,
        totalAmount: true, advancePayment: true, status: true, notes: true,
        eventItems: {
          select: {
            id: true, itemId: true, mealLabel: true, mealDate: true,
            mealGuests: true, mealPerPlate: true,
            item: { select: { id: true, name: true, category: { select: { id: true, name: true } } } }
          }
        },
        eventIngredients: {
          where: { quantity: { gt: 0 } },
          select: { id: true },
          take: 1
        }
      },
      orderBy: { functionDate: "desc" }
    })

    // CHANGED: an event is only "Ready" once nothing is still flagged for attention —
    // ingredients marked new (blue/green), removed (red) or shared (amber "also in
    // other meals, update qty"). One grouped query for all events, not one per event.
    const pendingByEvent = new Set(
      (await prisma.eventIngredient.groupBy({
        by: ["eventId"],
        where: {
          eventId: { in: events.map(e => e.id) },
          status: { in: ["new", "removed", "shared"] }
        }
      })).map(r => r.eventId)
    )

    // CHANGED: which events already have a bill, and what that bill says each owes.
    //
    // Owner only: staff must not learn anything about billing, so their rows carry no
    // bill info at all and their stage stops at Upcoming / Done / Cancelled.
    const billedByEvent = dbUser.role === "staff"
      ? new Map()
      : await billingByEvent(events.map(e => e.id), effectiveUserId)

    // CHANGED: staff must not receive advance-payment data. The history table already
    // hides the column and the CSV omits it, but the value was still sitting in this
    // response — visible in the browser's network tab. A permission enforced on only
    // one exit path isn't a permission, so it is stripped server-side too.
    const isStaff = dbUser.role === "staff"

    // Build unique meal labels for each event (for card display)
    const transformed = events.map(event => {
      const mealsMap = new Map<string, { label: string; date: any; guests: number | null }>()
      event.eventItems.forEach(ei => {
        if (ei.mealLabel) {
          // CHANGED: was `${label}-${mealDate}`, built by hand. Interpolating a Date
          // gives its full toString(), so two items of the same meal saved with
          // different times of day counted as two meals. mealKey() keys on the DATE
          // only, which is the rule CLAUDE.md requires everywhere.
          const key = mealKey(ei.mealLabel, ei.mealDate)
          if (!mealsMap.has(key)) {
            mealsMap.set(key, { label: ei.mealLabel, date: ei.mealDate, guests: ei.mealGuests })
          }
        }
      })
      const { advancePayment: _advancePayment, ...withoutAdvance } = event
      return {
        ...(isStaff ? withoutAdvance : event),
        eventIngredients: event.eventIngredients.length > 0 ? [{ id: 'has-qty', quantity: 1 }] : [],
        hasPendingIngredients: pendingByEvent.has(event.id),  // CHANGED: blocks the "Ready" badge
        mealLabels: Array.from(mealsMap.values()),
        // CHANGED: the LAST sub-event date. functionDate is the EARLIEST one and must
        // stay that way — it drives the "next event first" sort — so it cannot also
        // answer "is this event over?". A booking with breakfast on the 20th and dinner
        // on the 21st is not finished on the morning of the 21st.
        lastMealDate: latestMealDate(event.eventItems.map(ei => ei.mealDate)),
        billedAs: billedByEvent.get(event.id) || null,
        // CHANGED: what this event actually owes. Once it is on a bill the BILL decides
        // that — a discount or GST applied there has to reach this page, or a customer
        // who paid his discounted total in full keeps showing as Partial here.
        // Falls back to the quote while the event is not yet invoiced.
        receivable: billedByEvent.get(event.id)?.amount ?? event.totalAmount
      }
    })

    return NextResponse.json({ success: true, data: transformed })
})

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
    const functionDateValue = earliestMealDate(meals.map((m: any) => m.mealDate))
    if (!functionDateValue) {
      return NextResponse.json({ success: false, error: "Each meal needs a date" }, { status: 400 })
    }

    // Collect all item IDs to get their ingredients
    const allItemIds = Array.from(new Set(meals.flatMap((m: any) => m.selectedItems || [])))

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
    const eventItemsData: any[] = []
    meals.forEach((meal: any) => {
      (meal.selectedItems || []).forEach((itemId: string) => {
        eventItemsData.push({
          itemId,
          mealLabel: meal.mealType || null,
          mealDate: meal.mealDate ? new Date(meal.mealDate) : null,
          mealGuests: parseInt(meal.guestCount) || null,
          mealPerPlate: parseFloat(meal.perPlatePrice) || null
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

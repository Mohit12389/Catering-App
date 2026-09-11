import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { mealKey } from "@/lib/meals"  // CHANGED: shared composite meal key
import { planMealUpdates } from "@/lib/mealUpdate" // CHANGED: extracted two-phase planner
import { earliestMealDate, eventTotalFromItems } from "@/lib/eventRules" // CHANGED: shared total/date rules
import { withAuth } from "@/lib/withAuth" // CHANGED: replaces the repeated auth/dbUser/try-catch preamble

type Ctx = { params: { eventId: string } }


// CHANGED: the per-meal summing moved to eventTotalFromItems so it can be tested
// directly. This function is now just the read and the write around it.
async function recalcTotalAmount(eventId: string) {
  const allItems = await prisma.eventItem.findMany({
    where: { eventId },
    select: { mealLabel: true, mealDate: true, mealGuests: true, mealPerPlate: true }
  })
  await prisma.event.update({
    where: { id: eventId },
    data: { totalAmount: eventTotalFromItems(allItems) }
  })
}

export const GET = withAuth<Ctx>(async (_req, { dbUser, effectiveUserId }, { params }) => {
    // effectiveUserId keeps this scoped to the requesting business
    const event = await prisma.event.findFirst({
      where: { id: params.eventId, userId: effectiveUserId },
      select: {
        id: true, eventId: true, organizerName: true, phoneNumber: true,
        location: true, homeAddress: true, bookingDate: true, functionDate: true, functionTime: true,
        menuCreationDate: true, guestCount: true, perPlatePrice: true,
        totalAmount: true, advancePayment: true, status: true, notes: true,
        eventItems: {
          select: {
            id: true, itemId: true, mealLabel: true, mealDate: true,
            mealGuests: true, mealPerPlate: true,
            item: { select: { id: true, name: true, category: { select: { id: true, name: true, sortOrder: true } } } }
          }
        },
        eventIngredients: {
          select: {
            id: true, ingredientId: true, quantity: true, priceAtEvent: true, status: true, notes: true,
            ingredient: {
              select: { id: true, name: true, unit: true, ratePerUnit: true, category: { select: { id: true, name: true, sortOrder: true } } }
            }
          }
        },
        eventCategorySettings: { select: { id: true, ingredientCategoryId: true, boughtBy: true } },
        advancePayments: { select: { id: true, amount: true, paidDate: true, notes: true, createdAt: true }, orderBy: { paidDate: "asc" } }
      }
    })

    if (!event) return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 })

    // CHANGED: staff must not receive advance-payment data — not the cached total and
    // not the individual payments. The detail page already hides that whole section,
    // but the amounts, dates and notes were still in this response. See events/route.ts.
    if (dbUser.role === "staff") {
      const { advancePayment: _advancePayment, advancePayments: _advancePayments, ...withoutAdvance } = event
      return NextResponse.json({ success: true, data: withoutAdvance })
    }

    return NextResponse.json({ success: true, data: event })
})

export const PUT = withAuth<Ctx>(async (req: NextRequest, { effectiveUserId }, { params }) => {
    // verify this event actually belongs to the requesting business before allowing edits
    const ownedEvent = await prisma.event.findFirst({ where: { id: params.eventId, userId: effectiveUserId }, select: { id: true } })
    if (!ownedEvent) return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 })

    const body = await req.json()
    const { status, addItems, removeItems, removeMealLabel, updateMealLabels, ...updateData } = body

    const updatePayload: any = {}
    if (status) updatePayload.status = status
    if (updateData.organizerName) updatePayload.organizerName = updateData.organizerName
    if (updateData.phoneNumber) updatePayload.phoneNumber = updateData.phoneNumber
    if (updateData.location) updatePayload.location = updateData.location
    if (updateData.homeAddress !== undefined) updatePayload.homeAddress = updateData.homeAddress
    if (updateData.functionDate) updatePayload.functionDate = new Date(updateData.functionDate)
    if (updateData.functionTime) updatePayload.functionTime = updateData.functionTime
    if (updateData.guestCount) updatePayload.guestCount = parseInt(updateData.guestCount)
    if (updateData.notes !== undefined) updatePayload.notes = updateData.notes
    if (updateData.perPlatePrice !== undefined) updatePayload.perPlatePrice = parseFloat(updateData.perPlatePrice) || 0
    if (updateData.totalAmount !== undefined) updatePayload.totalAmount = parseFloat(updateData.totalAmount) || 0

    if (Object.keys(updatePayload).length > 0) {
      await prisma.event.update({ where: { id: params.eventId }, data: updatePayload })
    }

    // Update meal label metadata (date, type, guests, perPlate) per label+date group.
    //
    // CHANGED: the planning logic moved to lib/mealUpdate.ts so the test can call the
    // real function instead of a copy of it. Behaviour is unchanged — ids are still
    // resolved against the ORIGINAL rows before any write, which is what stops two
    // meals merging when their dates are swapped. One findMany now replaces the old
    // per-instruction query.
    if (updateMealLabels && Array.isArray(updateMealLabels)) {
      const rows = await prisma.eventItem.findMany({
        where: { eventId: params.eventId },
        select: { id: true, mealLabel: true, mealDate: true }
      })

      // PHASE 2 — apply by id, so an already-moved meal can never be picked up again
      for (const plan of planMealUpdates(rows, updateMealLabels)) {
        await prisma.eventItem.updateMany({ where: { id: { in: plan.ids } }, data: plan.data })
      }
    }

    // Add items
    if (addItems && Array.isArray(addItems) && addItems.length > 0) {
      const itemsToAdd = addItems.map((item: any) => {
        if (typeof item === 'string') return { itemId: item, mealLabel: null, mealDate: null, mealGuests: null, mealPerPlate: null }
        return {
          itemId: item.itemId, mealLabel: item.mealLabel || null,
          mealDate: item.mealDate ? new Date(item.mealDate) : null,
          mealGuests: item.mealGuests != null ? parseInt(String(item.mealGuests)) : null,
          mealPerPlate: item.mealPerPlate != null ? parseFloat(String(item.mealPerPlate)) : null
        }
      })

      const items = await prisma.item.findMany({
        where: { id: { in: itemsToAdd.map((i: any) => i.itemId) } },
        select: { id: true, itemIngredients: { select: { ingredientId: true } } }
      })

      await prisma.eventItem.createMany({
        data: itemsToAdd.map((item: any) => ({
          eventId: params.eventId, itemId: item.itemId, mealLabel: item.mealLabel,
          mealDate: item.mealDate, mealGuests: item.mealGuests, mealPerPlate: item.mealPerPlate
        }))
      })

      const existingIngredients = await prisma.eventIngredient.findMany({ where: { eventId: params.eventId }, select: { ingredientId: true } })
      const existingIds = new Set(existingIngredients.map(e => e.ingredientId))
      const newIds = new Set<string>()
      items.forEach(item => { item.itemIngredients.forEach(ii => { if (!existingIds.has(ii.ingredientId)) newIds.add(ii.ingredientId) }) })

      if (newIds.size > 0) {
        const prices = await prisma.ingredient.findMany({ where: { id: { in: Array.from(newIds) } }, select: { id: true, ratePerUnit: true } })
        const priceMap = new Map(prices.map(i => [i.id, i.ratePerUnit]))
        // CHANGED: Set status to "new" so green indicator persists in DB
        await prisma.eventIngredient.createMany({
          data: Array.from(newIds).map(id => ({
            eventId: params.eventId,
            ingredientId: id,
            quantity: 0,
            priceAtEvent: priceMap.get(id) || null,
            status: "new"
          }))
        })
      }
    }

    // Remove items
    if (removeItems && Array.isArray(removeItems) && removeItems.length > 0) {
      await prisma.eventItem.deleteMany({ where: { eventId: params.eventId, id: { in: removeItems } } })
      const remaining = await prisma.eventItem.findMany({ where: { eventId: params.eventId }, select: { item: { select: { itemIngredients: { select: { ingredientId: true } } } } } })
      const needed = new Set<string>()
      remaining.forEach(ei => { ei.item.itemIngredients.forEach(ii => needed.add(ii.ingredientId)) })

      // CHANGED: Mark orphaned ingredients with qty > 0 as "removed" instead of leaving them unmarked
      await prisma.eventIngredient.updateMany({
        where: { eventId: params.eventId, ingredientId: { notIn: Array.from(needed) }, quantity: { gt: 0 } },
        data: { status: "removed" }
      })

      // Delete orphaned ingredients with qty = 0 (no data to preserve)
      await prisma.eventIngredient.deleteMany({ where: { eventId: params.eventId, ingredientId: { notIn: Array.from(needed) }, quantity: 0 } })
    }

    // Remove meal label
    if (removeMealLabel) {
      await prisma.eventItem.deleteMany({ where: { eventId: params.eventId, mealLabel: removeMealLabel } })
      const remaining = await prisma.eventItem.findMany({ where: { eventId: params.eventId }, select: { item: { select: { itemIngredients: { select: { ingredientId: true } } } } } })
      const needed = new Set<string>()
      remaining.forEach(ei => { ei.item.itemIngredients.forEach(ii => needed.add(ii.ingredientId)) })

      if (needed.size > 0) {
        // CHANGED: Mark orphaned ingredients with qty > 0 as "removed"
        await prisma.eventIngredient.updateMany({
          where: { eventId: params.eventId, ingredientId: { notIn: Array.from(needed) }, quantity: { gt: 0 } },
          data: { status: "removed" }
        })
        await prisma.eventIngredient.deleteMany({ where: { eventId: params.eventId, ingredientId: { notIn: Array.from(needed) }, quantity: 0 } })
      } else {
        await prisma.eventIngredient.deleteMany({ where: { eventId: params.eventId, quantity: 0 } })
      }
    }

   // Recalc total and update functionDate to earliest sub-event date
    if (addItems || removeItems || removeMealLabel || updateMealLabels) {
      await recalcTotalAmount(params.eventId)

      // CHANGED: functionDate = earliest sub-event date, via the shared rule. The
      // orderBy + find-first-non-null is no longer needed; the rule skips nulls itself.
      const allItems = await prisma.eventItem.findMany({
        where: { eventId: params.eventId },
        select: { mealDate: true }
      })
      const earliestDate = earliestMealDate(allItems.map(i => i.mealDate))
      if (earliestDate) {
        await prisma.event.update({
          where: { id: params.eventId },
          data: { functionDate: earliestDate }
        })
      }
    }

    return NextResponse.json({ success: true, data: { id: params.eventId } })
})

export const DELETE = withAuth<Ctx>(async (_req, { effectiveUserId }, { params }) => {
    // verify this event actually belongs to the requesting business before deleting it
    const ownedEvent = await prisma.event.findFirst({ where: { id: params.eventId, userId: effectiveUserId }, select: { id: true } })
    if (!ownedEvent) return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 })

    await prisma.event.delete({ where: { id: params.eventId } })
    return NextResponse.json({ success: true, message: "Event deleted" })
})

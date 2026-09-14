import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { mealKey } from "@/lib/meals"  // CHANGED: shared composite meal key
import { withAuth } from "@/lib/withAuth" // CHANGED: replaces the repeated auth/user-lookup/403/try-catch preamble
import { latestMealDate } from "@/lib/eventRules" // CHANGED: last sub-event date decides whether an event has happened
import { paymentStatusOf, eventStage, balanceOf } from "@/lib/paymentStatus" // CHANGED: derived stage/payment state
import { billingByEvent } from "@/lib/eventBilling" // CHANGED: one place that answers "is it billed, and for how much"

// CHANGED: withAuth resolves the session, loads the user, derives effectiveUserId
// and — via { ownerOnly: true } — returns the 403 that each handler used to write
// by hand. Staff access is unchanged; it is now declared rather than remembered.
export const GET = withAuth(async (_req, { effectiveUserId }) => {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    // CHANGED: this whole page is now EVENT-centric instead of bill-centric.
    //
    // It used to take revenue from bills grouped by billDate while taking procurement
    // cost from events grouped by functionDate, then subtract one from the other. Two
    // different grains: a December wedding invoiced in January showed as pure cost in
    // December and pure profit in January, and an event not yet billed counted its full
    // procurement against zero revenue. The subtraction was not meaningful.
    //
    // Everything below is now grouped by functionDate — the date the food was actually
    // served — so revenue, payments and cost describe the same events in the same month.
    // The invoice register (bills) is still counted, but only as a count.
    const billCount = await prisma.bill.count({
      where: { userId: effectiveUserId, billDate: { gte: startOfYear } }
    })

    const events = await prisma.event.findMany({
      where: {
        userId: effectiveUserId,
        functionDate: { gte: startOfYear }
      },
      select: {
        id: true,
        eventId: true,
        organizerName: true,
        functionDate: true,
        totalAmount: true,
        advancePayment: true,  // CHANGED: payments are what make an event paid
        status: true,          // CHANGED: only "cancelled" is read from it
        guestCount: true,
        eventItems: {
          select: {
            mealLabel: true,
            mealDate: true,
            mealGuests: true,
            mealPerPlate: true
          }
        },
        eventIngredients: {
          where: { status: { not: "removed" } },
          select: {
            quantity: true,
            priceAtEvent: true,
            ingredient: {
              select: {
                ratePerUnit: true,
                categoryId: true
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
      }
    })

    // CHANGED: which events are on a bill, and what that bill says each owes. Revenue
    // follows the bill once one exists, so a discount reaches this page too.
    const billedByEvent = await billingByEvent(events.map(e => e.id), effectiveUserId)

    // Build per-event procurement cost and group by month
    interface MealLabelBreakdown {
      label: string
      date: string | null
      guests: number
      perPlate: number
    }

    interface EventBreakdown {
      eventId: string
      organizerName: string
      functionDate: string
      guestCount: number
      billAmount: number
      procurementCost: number
      profit: number
      mealLabels: MealLabelBreakdown[]
    }

    const monthlyEvents: EventBreakdown[][] = Array.from({ length: 12 }, () => [])
    const monthlyProcurement: number[] = new Array(12).fill(0)

    // CHANGED: revenue and payments now come from the SAME per-event walk as procurement,
    // so every series on this page is grouped by functionDate and the subtraction is valid.
    const monthlyRevenue: number[] = new Array(12).fill(0)
    const monthlyPaid: number[] = new Array(12).fill(0)
    const weeklyRevenue: number[] = new Array(7).fill(0)
    const weeklyPaid: number[] = new Array(7).fill(0)

    // CHANGED: the counts the owner actually asked for — how many events, how many are
    // closed, how many still owe money, how many finished events have no invoice yet.
    // These are EVENT states, not bill states.
    const stageCounts = { upcoming: 0, done: 0, completed: 0, cancelled: 0 }
    const statusCounts = { paid: 0, partial: 0, unpaid: 0, none: 0 }
    // CHANGED: billed is its own fact now, not a stage, so it is counted separately.
    let billedCount = 0
    let unbilledCount = 0
    let totalRevenue = 0
    let totalPaid = 0
    let totalOutstanding = 0

    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 7)

    for (const event of events) {
      const eventMonth = new Date(event.functionDate).getMonth()

      // ----- derived state for this event -----
      const isCancelled = event.status === "cancelled"
      const billing = billedByEvent.get(event.id)
      // Revenue is what the customer is actually being asked for: the bill's figure once
      // one exists, the quote until then.
      const receivable = billing?.amount ?? event.totalAmount
      const paymentStatus = paymentStatusOf(event.advancePayment || 0, receivable)
      const stage = eventStage({
        storedStatus: event.status,
        lastMealDate: latestMealDate(event.eventItems.map(ei => ei.mealDate)) ?? event.functionDate,
        isBilled: !!billing,
        paymentStatus,
        now
      })
      stageCounts[stage]++
      if (!isCancelled) {
        if (billing) billedCount++
        else unbilledCount++
      }

      // A cancelled event is not revenue and not an unpaid debt — it is not happening.
      if (!isCancelled) {
        statusCounts[paymentStatus]++
        totalRevenue += receivable
        totalPaid += event.advancePayment || 0
        totalOutstanding += balanceOf(event.advancePayment || 0, receivable)

        monthlyRevenue[eventMonth] += receivable
        monthlyPaid[eventMonth] += event.advancePayment || 0

        const fd = new Date(event.functionDate)
        if (fd >= startOfWeek && fd < endOfWeek) {
          weeklyRevenue[fd.getDay()] += event.totalAmount
          weeklyPaid[fd.getDay()] += event.advancePayment || 0
        }
      }
      
      const categoryBoughtBy: Record<string, string> = {}
      event.eventCategorySettings.forEach(cs => {
        categoryBoughtBy[cs.ingredientCategoryId] = cs.boughtBy
      })

      let eventProcurementCost = 0
      for (const ei of event.eventIngredients) {
        const catId = ei.ingredient?.categoryId || ""
        const boughtBy = categoryBoughtBy[catId] || "caterer"
        if (boughtBy === "client") continue
        const price = ei.priceAtEvent ?? ei.ingredient?.ratePerUnit ?? 0
        eventProcurementCost += ei.quantity * price
      }

      // Build meal labels from eventItems
      const mealGroupsMap: Record<string, MealLabelBreakdown> = {}
      event.eventItems.forEach((ei: any) => {
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

      // CHANGED: a cancelled event contributes neither revenue nor cost — counting its
      // procurement while excluding its revenue would show an invented loss.
      if (isCancelled) continue

      monthlyProcurement[eventMonth] += eventProcurementCost

      monthlyEvents[eventMonth].push({
        eventId: event.eventId,
        organizerName: event.organizerName,
        functionDate: event.functionDate.toISOString(),
        guestCount: event.guestCount,
        billAmount: receivable,
        procurementCost: Math.round(eventProcurementCost),
        profit: Math.round(receivable - eventProcurementCost),
        mealLabels: Object.values(mealGroupsMap)
      })
    }

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const weeklyData = days.map((day, i) => ({
      day,
      revenue: Math.round(weeklyRevenue[i]),
      paid: Math.round(weeklyPaid[i])
    }))

    const monthlyData = months.map((month, i) => ({
      month,
      revenue: Math.round(monthlyRevenue[i]),
      paid: Math.round(monthlyPaid[i])
    }))

    const profitData = months.map((month, i) => ({
      month,
      revenue: monthlyData[i].revenue,
      procurementCost: Math.round(monthlyProcurement[i]),
      profit: Math.round(monthlyData[i].revenue - monthlyProcurement[i]),
      eventBreakdown: monthlyEvents[i]
    }))

    return NextResponse.json({ 
      success: true, 
      data: {
        totalRevenue: Math.round(totalRevenue),
        totalPaid: Math.round(totalPaid),
        totalPending: Math.round(totalOutstanding),
        billCount,
        // CHANGED: event counts, replacing the bill counts this page used to show.
        eventCount: events.length,
        stageCounts,
        billedCount,
        unbilledCount,
        statusCounts,
        weeklyData,
        monthlyData,
        profitData
      }
    })
}, { ownerOnly: true })

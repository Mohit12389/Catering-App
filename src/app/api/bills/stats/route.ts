import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

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

    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    // Get all bills for the year
    const bills = await prisma.bill.findMany({
      where: {
        userId: dbUser.id,
        billDate: { gte: startOfYear }
      },
      select: {
        totalAmount: true,
        paidAmount: true,
        billDate: true,
        status: true
      },
      orderBy: { billDate: "asc" }
    })

    // Calculate totals
    const totalRevenue = bills.reduce((sum, b) => sum + b.totalAmount, 0)
    const totalPaid = bills.reduce((sum, b) => sum + b.paidAmount, 0)
    const totalPending = totalRevenue - totalPaid

    // Weekly data (last 7 days)
    const weeklyData: { day: string; revenue: number; paid: number }[] = []
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      const dayBills = bills.filter(b => {
        const billDate = new Date(b.billDate)
        return billDate.toDateString() === date.toDateString()
      })
      weeklyData.push({
        day: days[date.getDay()],
        revenue: dayBills.reduce((sum, b) => sum + b.totalAmount, 0),
        paid: dayBills.reduce((sum, b) => sum + b.paidAmount, 0)
      })
    }

    // Monthly data (last 12 months)
    const monthlyData: { month: string; revenue: number; paid: number }[] = []
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    for (let i = 0; i < 12; i++) {
      const monthBills = bills.filter(b => {
        const billDate = new Date(b.billDate)
        return billDate.getMonth() === i && billDate.getFullYear() === now.getFullYear()
      })
      monthlyData.push({
        month: months[i],
        revenue: monthBills.reduce((sum, b) => sum + b.totalAmount, 0),
        paid: monthBills.reduce((sum, b) => sum + b.paidAmount, 0)
      })
    }

    // Status counts
    const statusCounts = {
      paid: bills.filter(b => b.status === "paid").length,
      partial: bills.filter(b => b.status === "partial").length,
      unpaid: bills.filter(b => b.status === "unpaid").length
    }

    // ===== Profit data with per-event breakdown =====
    const events = await prisma.event.findMany({
      where: {
        userId: dbUser.id,
        functionDate: { gte: startOfYear }
      },
      select: {
        id: true,
        eventId: true,
        organizerName: true,
        functionDate: true,
        totalAmount: true,
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

    for (const event of events) {
      const eventMonth = new Date(event.functionDate).getMonth()
      
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
        const dateStr = ei.mealDate ? String(ei.mealDate).split("T")[0] : ""
        const key = `${label}::${dateStr}`
        if (!mealGroupsMap[key]) {
          mealGroupsMap[key] = {
            label,
            date: ei.mealDate ? String(ei.mealDate) : null,
            guests: ei.mealGuests || 0,
            perPlate: ei.mealPerPlate || 0
          }
        }
      })

      monthlyProcurement[eventMonth] += eventProcurementCost

      monthlyEvents[eventMonth].push({
        eventId: event.eventId,
        organizerName: event.organizerName,
        functionDate: event.functionDate.toISOString(),
        guestCount: event.guestCount,
        billAmount: event.totalAmount,
        procurementCost: Math.round(eventProcurementCost),
        profit: Math.round(event.totalAmount - eventProcurementCost),
        mealLabels: Object.values(mealGroupsMap)
      })
    }

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
        totalRevenue,
        totalPaid,
        totalPending,
        billCount: bills.length,
        statusCounts,
        weeklyData,
        monthlyData,
        profitData
      }
    })
  } catch (error) {
    console.error("Error fetching stats:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch stats" }, { status: 500 })
  }
}
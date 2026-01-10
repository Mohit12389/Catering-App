import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

// GET - Get bill statistics for charts
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
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
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

    return NextResponse.json({ 
      success: true, 
      data: {
        totalRevenue,
        totalPaid,
        totalPending,
        billCount: bills.length,
        statusCounts,
        weeklyData,
        monthlyData
      }
    })
  } catch (error) {
    console.error("Error fetching stats:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch stats" }, { status: 500 })
  }
}

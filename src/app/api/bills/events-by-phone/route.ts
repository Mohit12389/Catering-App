import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

// GET - Fetch events by phone number
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
    const phoneNumber = searchParams.get("phoneNumber")

    if (!phoneNumber) {
      return NextResponse.json({ success: false, error: "Phone number required" }, { status: 400 })
    }

    // Find events that contain this phone number
    const events = await prisma.event.findMany({
      where: {
        userId: dbUser.id,
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
        status: true
      },
      orderBy: { functionDate: "desc" }
    })

    return NextResponse.json({ success: true, data: events })
  } catch (error) {
    console.error("Error fetching events:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch events" }, { status: 500 })
  }
}

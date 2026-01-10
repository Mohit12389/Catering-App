import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

// GET - Get current user's organization
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        name: true,
        email: true,
        organizationName: true,
        organizationLogo: true
      }
    })

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: user })
  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch user" }, { status: 500 })
  }
}

// PUT - Update organization name
export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { organizationName, organizationLogo } = body

    if (!organizationName || organizationName.trim().length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: "Organization name is required" 
      }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { clerkId: userId },
      data: {
        organizationName: organizationName.trim(),
        ...(organizationLogo !== undefined && { organizationLogo })
      },
      select: {
        id: true,
        name: true,
        email: true,
        organizationName: true,
        organizationLogo: true
      }
    })

    return NextResponse.json({ success: true, data: user })
  } catch (error) {
    console.error("Error updating organization:", error)
    return NextResponse.json({ success: false, error: "Failed to update organization" }, { status: 500 })
  }
}

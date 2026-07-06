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
        organizationLogo: true,
        role: true,       // CHANGED: Added role
        ownerId: true     // CHANGED: Added ownerId
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

// PUT - Update organization name and/or role
export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    // CHANGED: Accept role in addition to organizationName and organizationLogo
    const { organizationName, organizationLogo, role } = body

    // If only role is being set (staff onboarding), don't require organizationName
    if (!role && (!organizationName || organizationName.trim().length === 0)) {
      return NextResponse.json({ 
        success: false, 
        error: "Organization name is required" 
      }, { status: 400 })
    }

    // CHANGED: Build update data dynamically — only include fields that were sent
    const updateData: any = {}
    if (organizationName) updateData.organizationName = organizationName.trim()
    if (organizationLogo !== undefined) updateData.organizationLogo = organizationLogo
    if (role) updateData.role = role  // CHANGED: Save role if provided

    const user = await prisma.user.update({
      where: { clerkId: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        organizationName: true,
        organizationLogo: true,
        role: true,       // CHANGED: Return role
        ownerId: true     // CHANGED: Return ownerId
      }
    })

    return NextResponse.json({ success: true, data: user })
  } catch (error) {
    console.error("Error updating organization:", error)
    return NextResponse.json({ success: false, error: "Failed to update organization" }, { status: 500 })
  }
}
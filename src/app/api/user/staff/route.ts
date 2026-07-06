import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

// =============================================
// ROLE-BASED ACCESS: Staff Management API
// =============================================
// Only owners can add/remove staff
// GET - List staff members
// POST - Add staff by email
// DELETE - Remove staff member

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      // CHANGED: Select role to check permissions
      select: { id: true, role: true }
    })

    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Only owners can list staff
    if (dbUser.role !== "owner") {
      return NextResponse.json({ success: false, error: "Only owners can manage staff" }, { status: 403 })
    }

    // Get all staff linked to this owner
    const staff = await prisma.user.findMany({
      where: { ownerId: dbUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json({ success: true, data: staff })
  } catch (error) {
    console.error("Error fetching staff:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch staff" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true }
    })

    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Only owners can add staff
    if (dbUser.role !== "owner") {
      return NextResponse.json({ success: false, error: "Only owners can add staff" }, { status: 403 })
    }

    const { email } = await req.json()
    if (!email || !email.trim()) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 })
    }

    const trimmedEmail = email.trim().toLowerCase()

    // Check if staff user exists in the system
    const staffUser = await prisma.user.findUnique({
      where: { email: trimmedEmail },
      select: { id: true, role: true, ownerId: true, email: true, name: true }
    })

    if (!staffUser) {
      return NextResponse.json({
        success: false,
        error: "No user found with this email. They need to sign up first and select 'Staff' during onboarding."
      }, { status: 404 })
    }

    // Can't add yourself
    if (staffUser.id === dbUser.id) {
      return NextResponse.json({ success: false, error: "You cannot add yourself as staff" }, { status: 400 })
    }

    // Must be a staff user (not an owner)
    if (staffUser.role !== "staff") {
      return NextResponse.json({
        success: false,
        error: "This user is registered as an owner. They need to select 'Staff' during onboarding."
      }, { status: 400 })
    }

    // Check if already linked to another owner
    if (staffUser.ownerId && staffUser.ownerId !== dbUser.id) {
      return NextResponse.json({
        success: false,
        error: "This staff member is already linked to another business."
      }, { status: 400 })
    }

    // Check if already linked to this owner
    if (staffUser.ownerId === dbUser.id) {
      return NextResponse.json({
        success: false,
        error: "This person is already your staff member."
      }, { status: 400 })
    }

    // Link staff to owner
    const updated = await prisma.user.update({
      where: { id: staffUser.id },
      data: { ownerId: dbUser.id },
      select: { id: true, email: true, name: true, createdAt: true }
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error("Error adding staff:", error)
    return NextResponse.json({ success: false, error: "Failed to add staff" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true }
    })

    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    if (dbUser.role !== "owner") {
      return NextResponse.json({ success: false, error: "Only owners can remove staff" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const staffId = searchParams.get("staffId")

    if (!staffId) {
      return NextResponse.json({ success: false, error: "staffId is required" }, { status: 400 })
    }

    // Verify the staff belongs to this owner
    const staffUser = await prisma.user.findFirst({
      where: { id: staffId, ownerId: dbUser.id }
    })

    if (!staffUser) {
      return NextResponse.json({ success: false, error: "Staff member not found" }, { status: 404 })
    }

    // Unlink staff (set ownerId to null)
    await prisma.user.update({
      where: { id: staffId },
      data: { ownerId: null }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error removing staff:", error)
    return NextResponse.json({ success: false, error: "Failed to remove staff" }, { status: 500 })
  }
}
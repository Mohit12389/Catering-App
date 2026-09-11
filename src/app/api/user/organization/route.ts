import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/withAuth" // CHANGED: replaces the repeated auth/user-lookup/try-catch preamble

// CHANGED: this route is about the SIGNED-IN user's own row, not about business data,
// so it uses clerkId and never effectiveUserId — a staff member reading their own role
// must not be handed the owner's. GET still runs its own findUnique because it returns
// name/email/organizationName/organizationLogo, which withAuth does not load; that is
// one extra indexed lookup, accepted so every route shares one auth path. PUT needs no
// extra query — it updates by clerkId directly, and withAuth has already proved the row
// exists, which also turns a missing row from a P2025 500 into a clean 404.

// GET - Get current user's organization
export const GET = withAuth(async (_req, { clerkId }) => {
    const user = await prisma.user.findUnique({
      where: { clerkId },
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
})

// PUT - Update organization name and/or role
export const PUT = withAuth(async (req: NextRequest, { dbUser, clerkId }) => {
    const body = await req.json()
    // CHANGED: Accept role in addition to organizationName and organizationLogo
    const { organizationName, organizationLogo, role } = body

    // CHANGED: staff must not rename the business. This route writes the CALLER's own
    // row, so a staff member renaming it only dirtied their own record rather than the
    // owner's — but /settings offered them the field and nothing here refused it. The
    // navbar still showed the owner's name (layout.tsx looks that up via ownerId), so
    // the edit silently went nowhere, which is worse than refusing it outright.
    if ((organizationName !== undefined || organizationLogo !== undefined) && dbUser.role === "staff") {
      return NextResponse.json(
        { success: false, error: "Only owners can change the organization name" },
        { status: 403 }
      )
    }

    // CHANGED: role is chosen ONCE, during onboarding, while it is still null. Without
    // this, a staff account could PUT { role: "owner" } and promote itself out of staff:
    // getEffectiveUserId would stop redirecting it to the owner's id and every
    // ownerOnly route would let it through. It would see its own empty business rather
    // than the owner's data, but it would have escaped the staff role entirely.
    if (role && dbUser.role) {
      return NextResponse.json(
        { success: false, error: "Your role has already been set and cannot be changed" },
        { status: 403 }
      )
    }

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
      where: { clerkId },
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
})

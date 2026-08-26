import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { getEffectiveUserId } from "@/lib/getEffectiveUserId" // CHANGED: needed for ownership checks below

// CHANGED: shared helper — confirms this eventId actually belongs to the requesting business
async function assertOwnsEvent(clerkUserId: string, eventId: string) {
  const dbUser = await prisma.user.findUnique({ where: { clerkId: clerkUserId }, select: { id: true, role: true, ownerId: true } })
  if (!dbUser) return false
  const event = await prisma.event.findFirst({ where: { id: eventId, userId: getEffectiveUserId(dbUser) }, select: { id: true } })
  return !!event
}

export async function GET(
  req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // CHANGED: don't return another business's category settings
    if (!(await assertOwnsEvent(userId, params.eventId))) {
      return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 })
    }

    const settings = await prisma.eventCategorySetting.findMany({
      where: { eventId: params.eventId }
    })

    return NextResponse.json({ success: true, data: settings })
  } catch (error) {
    console.error("Error fetching category settings:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch settings" }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // CHANGED: don't let someone write category settings onto another business's event
    if (!(await assertOwnsEvent(userId, params.eventId))) {
      return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 })
    }

    const { categoryId, boughtBy } = await req.json()

    if (!categoryId || !boughtBy) {
      return NextResponse.json({ success: false, error: "categoryId and boughtBy are required" }, { status: 400 })
    }

    // Upsert the setting
    const setting = await prisma.eventCategorySetting.upsert({
      where: {
        eventId_ingredientCategoryId: {
          eventId: params.eventId,
          ingredientCategoryId: categoryId
        }
      },
      update: { boughtBy },
      create: {
        eventId: params.eventId,
        ingredientCategoryId: categoryId,
        boughtBy
      }
    })

    return NextResponse.json({ success: true, data: setting })
  } catch (error) {
    console.error("Error saving category setting:", error)
    return NextResponse.json({ success: false, error: "Failed to save setting" }, { status: 500 })
  }
}

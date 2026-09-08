import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/withAuth" // CHANGED: replaces the repeated auth/dbUser/try-catch preamble

// CHANGED: shared helper — confirms this eventId actually belongs to the requesting
// business. It no longer looks the user up itself: withAuth has already resolved
// effectiveUserId, so this is one query per request instead of two.
async function ownsEvent(effectiveUserId: string, eventId: string) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, userId: effectiveUserId },
    select: { id: true }
  })
  return !!event
}

type Ctx = { params: { eventId: string } }

export const GET = withAuth<Ctx>(async (_req, { effectiveUserId }, { params }) => {
  // don't return another business's category settings
  if (!(await ownsEvent(effectiveUserId, params.eventId))) {
    return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 })
  }

  const settings = await prisma.eventCategorySetting.findMany({
    where: { eventId: params.eventId }
  })

  return NextResponse.json({ success: true, data: settings })
})

export const POST = withAuth<Ctx>(async (req: NextRequest, { effectiveUserId }, { params }) => {
  // don't let someone write category settings onto another business's event
  if (!(await ownsEvent(effectiveUserId, params.eventId))) {
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
})

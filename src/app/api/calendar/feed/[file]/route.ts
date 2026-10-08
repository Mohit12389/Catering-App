import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildCalendar, verifyFeedFile } from "@/lib/calendarFeed"

// CHANGED: new — Google Calendar subscription feed (see lib/calendarFeed.ts).
// PUBLIC by design (listed in middleware): Google fetches it with no Clerk session,
// so the HMAC token in the file name is the only guard. No withAuth here.
//
// Neon compute: one Google fetch = 2 small queries. The Cache-Control below lets
// Vercel's CDN answer repeat fetches for an hour without touching the database.

export async function GET(req: NextRequest, { params }: { params: { file: string } }) {
  const secret = process.env.CALENDAR_FEED_SECRET
  if (!secret) {
    return new NextResponse("Calendar feed is not configured", { status: 503 })
  }

  const userId = verifyFeedFile(params.file, secret)
  if (!userId) {
    return new NextResponse("Not found", { status: 404 })
  }

  try {
    // From one year back, so recent past events stay visible; cancelled ones never.
    const since = new Date()
    since.setFullYear(since.getFullYear() - 1)

    const [user, events] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { organizationName: true } }),
      prisma.event.findMany({
        where: { userId, status: { not: "cancelled" }, functionDate: { gte: since } },
        select: {
          id: true, eventId: true, organizerName: true, phoneNumber: true,
          location: true, homeAddress: true, functionDate: true,
          eventItems: { select: { mealLabel: true, mealDate: true, mealGuests: true } }
        },
        orderBy: { functionDate: "asc" }
      })
    ])
    if (!user) {
      return new NextResponse("Not found", { status: 404 })
    }

    const ics = buildCalendar(events, {
      calendarName: `${user.organizationName || "Anchal Caterers"} – Events`,
      appOrigin: new URL(req.url).origin
    })

    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600"
      }
    })
  } catch (error) {
    console.error("Calendar feed error:", error)
    return new NextResponse("Server error", { status: 500 })
  }
}

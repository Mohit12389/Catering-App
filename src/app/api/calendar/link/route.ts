import { NextResponse } from "next/server"
import { withAuth } from "@/lib/withAuth"
import { feedToken } from "@/lib/calendarFeed"

// CHANGED: new — gives the OWNER their private Google Calendar feed path.
// ownerOnly: staff must not get the link (owner's choice; the feed is the owner's
// whole schedule). The feed is keyed by the owner's own id.
export const GET = withAuth(async (_req, { effectiveUserId }) => {
  const secret = process.env.CALENDAR_FEED_SECRET
  if (!secret) {
    return NextResponse.json(
      { success: false, error: "CALENDAR_FEED_SECRET is not set on the server" },
      { status: 503 }
    )
  }
  return NextResponse.json({
    success: true,
    data: { path: `/api/calendar/feed/${effectiveUserId}-${feedToken(effectiveUserId, secret)}.ics` }
  })
}, { ownerOnly: true })

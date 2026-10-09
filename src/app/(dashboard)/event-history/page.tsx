// CHANGED: new server component. The table itself is unchanged in EventHistoryClient.tsx
// (it was this file). Before, the page's code loaded in the browser and only THEN asked
// /api/events for the rows — a second India→USA round trip before the table appeared.
// Now the rows are built here, next to the database, and arrive with the page.
import { getDashboardUser } from "@/lib/getDashboardUser" // same cached result the layout loaded — no extra Clerk call
import { getEffectiveUserId } from "@/lib/getEffectiveUserId" // staff see the owner's events
import { listEvents } from "@/lib/eventList" // the same rows GET /api/events returns (incl. staff stripping)
import type { EventListRow } from "@/types"
import { EventHistoryClient } from "./EventHistoryClient"

export default async function EventHistoryPage() {
  let initialEvents: EventListRow[] | undefined
  try {
    const me = await getDashboardUser()
    if (me) {
      const rows = await listEvents({ effectiveUserId: getEffectiveUserId(me.dbUser), role: me.dbUser.role })
      // Round-trip through JSON so the rows are EXACTLY what /api/events sends (dates as
      // strings), which is what EventHistoryClient and SWR's later re-check expect.
      initialEvents = JSON.parse(JSON.stringify(rows))
    }
  } catch (error) {
    // Not fatal: without initialEvents the table loads from /api/events in the browser,
    // exactly as it did before this change.
    console.error("[event-history page] server load failed", error)
  }

  return <EventHistoryClient initialEvents={initialEvents} />
}

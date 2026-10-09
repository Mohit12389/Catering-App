// CHANGED: new server component. The page itself is unchanged in EventDetailClient.tsx
// (it was this file). Before, the page's code loaded in the browser and only THEN asked
// /api/events/<id> for the event — a second India→USA round trip before anything showed.
// Now the event is loaded here, next to the database, and arrives with the page.
import { getDashboardUser } from "@/lib/getDashboardUser" // same cached result the layout loaded — no extra Clerk call
import { getEffectiveUserId } from "@/lib/getEffectiveUserId" // staff see the owner's events
import { getEventDetail } from "@/lib/eventDetail" // the same data GET /api/events/<id> returns (incl. staff stripping)
import type { EventDetail } from "@/types"
import { EventDetailClient } from "./EventDetailClient"

export default async function EventHistoryDetailPage({ params }: { params: { eventId: string } }) {
  let initialEvent: EventDetail | undefined
  try {
    const me = await getDashboardUser()
    if (me) {
      const event = await getEventDetail({
        eventId: params.eventId,
        effectiveUserId: getEffectiveUserId(me.dbUser),
        role: me.dbUser.role,
      })
      // Round-trip through JSON so the event is EXACTLY what the API sends (dates as
      // strings), which is what EventDetailClient and its later re-check expect.
      if (event) initialEvent = JSON.parse(JSON.stringify(event))
    }
  } catch (error) {
    // Not fatal: without initialEvent the page loads from the API in the browser,
    // exactly as it did before this change.
    console.error("[event-history detail page] server load failed", error)
  }

  // Not found / other business → no initialEvent → the client fetches and shows its
  // usual "not found" state, same as before.
  return <EventDetailClient initialEvent={initialEvent} />
}

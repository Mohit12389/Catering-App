// =============================================
// GOOGLE CALENDAR SUBSCRIPTION FEED (.ics)
// =============================================
// CHANGED: new. The owner subscribes Google Calendar to a private URL; Google fetches
// it every few hours. One calendar entry per MEAL (sub-event), all-day, on the meal's
// date — a 3-meal wedding shows as 3 entries.
//
// Google cannot sign in through Clerk, so the URL itself is the password:
//   /api/calendar/feed/<ownerUserId>-<token>.ics,  token = HMAC(CALENDAR_FEED_SECRET, userId)
// No DB column needed. Changing CALENDAR_FEED_SECRET revokes every old link.
//
// The feed carries NO money (no per-plate, totals, advances) — if the link leaks, it
// shows dates, names and venues only.

import { createHmac, timingSafeEqual } from "node:crypto"
import { MEAL_TYPES, compareMeals, mealKey } from "@/lib/meals"

export function feedToken(userId: string, secret: string): string {
  return createHmac("sha256", secret).update(`calendar-feed:${userId}`).digest("hex").slice(0, 32)
}

/** Parse "<userId>-<token>.ics" and check the token. Returns the userId or null. */
export function verifyFeedFile(file: string, secret: string): string | null {
  const m = /^([a-z0-9]+)-([a-f0-9]{32})\.ics$/.exec(file)
  if (!m) return null
  const [, userId, token] = m
  const expected = Buffer.from(feedToken(userId, secret))
  const given = Buffer.from(token)
  return expected.length === given.length && timingSafeEqual(expected, given) ? userId : null
}

export interface FeedEvent {
  id: string
  eventId: string
  organizerName: string
  phoneNumber: string
  location: string
  homeAddress: string | null
  functionDate: Date
  eventItems: { mealLabel: string | null; mealDate: Date | null; mealGuests: number | null }[]
}

/** ICS TEXT escaping (RFC 5545 §3.3.11). */
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")
}

/** Fold to 75 octets per line, never splitting a multi-byte (Hindi) character. */
function fold(line: string): string {
  const out: string[] = []
  let cur = ""
  let bytes = 0
  for (const ch of Array.from(line)) {
    const b = Buffer.byteLength(ch)
    const limit = out.length === 0 ? 75 : 74 // continuation lines start with a space
    if (bytes + b > limit) {
      out.push(cur)
      cur = ""
      bytes = 0
    }
    cur += ch
    bytes += b
  }
  out.push(cur)
  return out.join("\r\n ")
}

/** "2026-10-21" -> "20261021"; same date convention as mealKey (UTC date part). */
const icsDate = (d: Date) => d.toISOString().split("T")[0].replace(/-/g, "")
const nextDay = (d: Date) => new Date(d.getTime() + 24 * 60 * 60 * 1000)

function mealName(label: string | null): string {
  if (!label) return "Event"
  const known = MEAL_TYPES.find(t => t.value === label)
  return known ? known.label.split(" / ")[0] : label
}

export function buildCalendar(events: FeedEvent[], opts: { calendarName: string; appOrigin: string; now?: Date }): string {
  const stamp = (opts.now ?? new Date()).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Anchal Caterers//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(opts.calendarName)}`,
    "X-PUBLISHED-TTL:PT1H", // hint only — Google picks its own refresh interval
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ]

  for (const ev of events) {
    // One entry per meal, keyed by the composite meal key (label + date), never label alone.
    const meals = new Map<string, { label: string | null; date: Date; guests: number }>()
    for (const ei of ev.eventItems) {
      if (!ei.mealDate) continue
      const key = mealKey(ei.mealLabel, ei.mealDate)
      if (!meals.has(key)) meals.set(key, { label: ei.mealLabel, date: ei.mealDate, guests: ei.mealGuests || 0 })
    }
    // An event with no meals yet still shows up, on its function date.
    if (meals.size === 0) meals.set("none", { label: null, date: ev.functionDate, guests: 0 })

    const sorted = Array.from(meals.values()).sort(compareMeals)
    const details = [
      `Event ID: ${ev.eventId}`,
      `Phone: ${ev.phoneNumber}`,
      `Venue / कार्यक्रम स्थल: ${ev.location}`,
      ev.homeAddress ? `Home / घर का पता: ${ev.homeAddress}` : null,
      `${opts.appOrigin}/event-history/${ev.id}`,
    ].filter(Boolean).join("\n")

    for (const meal of sorted) {
      const summary = `${mealName(meal.label)} – ${ev.organizerName}${meal.guests ? ` – ${meal.guests} guests` : ""}`
      lines.push(
        "BEGIN:VEVENT",
        `UID:${ev.id}-${mealKey(meal.label, meal.date).replace(/[^a-zA-Z0-9-]/g, "_")}@anchal-caterers`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${icsDate(meal.date)}`,
        `DTEND;VALUE=DATE:${icsDate(nextDay(meal.date))}`,
        `SUMMARY:${esc(summary)}`,
        `LOCATION:${esc(ev.location)}`,
        `DESCRIPTION:${esc(details)}`,
        "TRANSP:TRANSPARENT",
        "END:VEVENT"
      )
    }
  }

  lines.push("END:VCALENDAR")
  return lines.map(fold).join("\r\n") + "\r\n"
}

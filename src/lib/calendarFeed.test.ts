import { describe, it, expect } from "vitest"
import { buildCalendar, feedToken, verifyFeedFile, type FeedEvent } from "./calendarFeed"

// CHANGED: covers the Google Calendar feed — link token and the .ics it produces.

const SECRET = "test-secret"
const d = (s: string) => new Date(`${s}T00:00:00.000Z`)

describe("feed link token", () => {
  it("accepts the file name the link route hands out", () => {
    const file = `cluser123-${feedToken("cluser123", SECRET)}.ics`
    expect(verifyFeedFile(file, SECRET)).toBe("cluser123")
  })

  it("rejects a wrong token, another user's id, a different secret, or junk", () => {
    const token = feedToken("cluser123", SECRET)
    expect(verifyFeedFile(`cluser999-${token}.ics`, SECRET)).toBeNull()
    expect(verifyFeedFile(`cluser123-${token}.ics`, "other-secret")).toBeNull()
    expect(verifyFeedFile(`cluser123-${"0".repeat(32)}.ics`, SECRET)).toBeNull()
    expect(verifyFeedFile("cluser123.ics", SECRET)).toBeNull()
    expect(verifyFeedFile("../etc/passwd", SECRET)).toBeNull()
  })
})

const wedding: FeedEvent = {
  id: "ev1", eventId: "EVT-001", organizerName: "Sharma, Ram", phoneNumber: "9999999999",
  location: "Shanti Hall; Jaipur", homeAddress: null, functionDate: d("2026-10-20"),
  eventItems: [
    // several items per meal — must collapse to ONE entry per meal
    { mealLabel: "dinner", mealDate: d("2026-10-21"), mealGuests: 200 },
    { mealLabel: "dinner", mealDate: d("2026-10-21"), mealGuests: 200 },
    { mealLabel: "breakfast", mealDate: d("2026-10-20"), mealGuests: 100 },
    // same type, different date — must NOT merge with the 20th
    { mealLabel: "breakfast", mealDate: d("2026-10-21"), mealGuests: 200 },
  ],
}

const unfold = (ics: string) => ics.replace(/\r\n /g, "")

describe("buildCalendar", () => {
  const ics = buildCalendar([wedding], { calendarName: "Anchal – Events", appOrigin: "https://x.app", now: d("2026-10-08") })
  const flat = unfold(ics)

  it("makes one all-day entry per meal, keyed by label AND date", () => {
    expect(flat.match(/BEGIN:VEVENT/g)?.length).toBe(3)
    expect(flat).toContain("DTSTART;VALUE=DATE:20261020")
    expect(flat).toContain("DTEND;VALUE=DATE:20261022") // dinner on the 21st ends next day
    expect(flat).toContain("SUMMARY:Breakfast – Sharma\\, Ram – 100 guests")
    expect(flat).toContain("SUMMARY:Dinner – Sharma\\, Ram – 200 guests")
  })

  it("escapes ICS special characters and links back to the event", () => {
    expect(flat).toContain("LOCATION:Shanti Hall\\; Jaipur")
    expect(flat).toContain("https://x.app/event-history/ev1")
  })

  it("never includes money", () => {
    expect(flat).not.toMatch(/₹|per plate|perPlate|advance/i)
  })

  it("uses CRLF and folds long lines without breaking Hindi characters", () => {
    expect(ics.endsWith("\r\n")).toBe(true)
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75)
    expect(flat).toContain("Venue / कार्यक्रम स्थल")
  })

  it("still shows an event with no meals, on its function date", () => {
    const empty = unfold(buildCalendar([{ ...wedding, eventItems: [] }], { calendarName: "x", appOrigin: "" }))
    expect(empty.match(/BEGIN:VEVENT/g)?.length).toBe(1)
    expect(empty).toContain("DTSTART;VALUE=DATE:20261020")
    expect(empty).toContain("SUMMARY:Event – Sharma\\, Ram")
  })
})

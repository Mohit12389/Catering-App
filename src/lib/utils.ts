import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateEventId(): string {
  const year = new Date().getFullYear()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `EVT-${year}-${random}`
}

// =============================================
// LOCALE AND TIME ZONE ARE PINNED ON PURPOSE
// =============================================
// CHANGED: never format a user-facing number or date without an explicit locale
// AND time zone. Both default to the RUNTIME's settings, which are not the same
// on the server as in the browser, so the same value renders as different text on
// each side and React reports "Text content does not match server-rendered HTML",
// dropping the surrounding Suspense boundary to client-only rendering.
//
//   Numbers: Node resolves to en-US -> "1,234,567"; a browser in India resolves to
//   en-IN -> "12,34,567". This only bites from Rs 1,00,000 upward, because below
//   that the two groupings agree — which is why it showed on large bills only.
//
//   Dates: this machine's Node runs in Asia/Calcutta, but Vercel's servers run in
//   UTC. A record created between 00:00 and 05:30 IST is still the PREVIOUS day in
//   UTC, so in production the server rendered one date and the browser another.
//   That was both a hydration mismatch and a plain wrong date on screen.
// CHANGED: coerce a money value arriving in a request body to a usable number.
// The bill routes multiplied item.quantity * item.rate straight off the parsed JSON,
// so a missing, empty or non-numeric value produced NaN and NaN was written to the
// database as the bill total. The UI already sends 0 for a cleared field, so this is
// a backstop for any other caller — and it cannot reject input that works today.
export function toAmount(value: unknown): number {
  return Number(value) || 0
}

export const LOCALE = 'en-IN'
export const TIME_ZONE = 'Asia/Kolkata'

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TIME_ZONE,
  })
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: TIME_ZONE,
  })
}

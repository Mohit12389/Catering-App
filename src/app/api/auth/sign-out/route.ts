// CHANGED: new route — own login (replaced Clerk, 2026-10-28). Clears the login cookie.
import { NextResponse } from "next/server"
import { endSession } from "@/lib/session"

export async function POST() {
  endSession()
  return NextResponse.json({ success: true })
}

// CHANGED: own login replaced Clerk (2026-10-28). Same job as clerkMiddleware: public
// routes pass, everything else needs a valid login cookie. It only checks the cookie's
// signature (no DB, no network), so it adds no wait. withAuth / the (dashboard) layout
// still load the user row and enforce roles — this is only the front door.
import { NextRequest, NextResponse } from "next/server"
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sessionToken"

const PUBLIC_PATHS = [
  /^\/$/,
  /^\/sign-in(\/.*)?$/,
  /^\/sign-up(\/.*)?$/,
  /^\/api\/auth\/(sign-in|sign-up|sign-out)$/, // CHANGED: the login routes themselves
  /^\/api\/health(\/.*)?$/,
  /^\/api\/calendar\/feed(\/.*)?$/,           // Google Calendar fetches this with no login; guarded by the token in the URL
]

export default async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (PUBLIC_PATHS.some(p => p.test(pathname))) return NextResponse.next()

  const userId = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)
  if (userId) return NextResponse.next()

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }
  // Pages: go to sign-in, then come back here afterwards
  const url = new URL("/sign-in", request.url)
  url.searchParams.set("next", pathname + search)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}

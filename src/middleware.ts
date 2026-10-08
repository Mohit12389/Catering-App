import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/health(.*)",   // ← ADD THIS LINE
  "/api/calendar/feed(.*)"   // CHANGED: Google Calendar fetches this with no login; guarded by the token in the URL
])

export default clerkMiddleware((auth, request) => {

  if (!isPublicRoute(request)) {
    auth().protect()
  }
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
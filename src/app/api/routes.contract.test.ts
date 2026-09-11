import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

// =============================================
// API ROUTE CONTRACT
// =============================================
// This is the test the withAuth migration existed to make possible.
//
// The rule from CLAUDE.md is that EVERY user-scoped route resolves ownership
// through one helper, because getting it wrong in any single route leaks one
// business's data to another. That used to be ~26 chances to forget. Now it is a
// property of the source that can be checked, so a new route cannot quietly skip
// it — the failure shows up here instead of in production.
//
// It reads the files as text on purpose. Importing them would pull in Prisma and
// Clerk and need mocking per route, and the thing being checked is the SHAPE of
// each route, not its behaviour.

const API_DIR = join(process.cwd(), "src/app/api")

// Routes with no signed-in user, by design:
//   health        — public uptime probe, listed in middleware's public routes
//   webhooks/clerk — called BY Clerk, has no session; must stay public or new
//                    sign-ups never get a User row
const PUBLIC_ROUTES = ["health", "webhooks/clerk"]

// Routes that must refuse staff. Billing, revenue and procurement are the owner's
// private financial data (CLAUDE.md). advance-payments is here deliberately: staff
// see no advances anywhere in the UI, so the API must not serve them either.
const OWNER_ONLY = [
  "advance-payments",
  "bills",
  "bills/[billId]",
  "bills/events-by-phone",
  "bills/stats",
  "category-payments",
  "procurement",
]

function findRoutes(dir: string, prefix = ""): { id: string; source: string }[] {
  const out: { id: string; source: string }[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...findRoutes(full, prefix ? `${prefix}/${entry}` : entry))
    } else if (entry === "route.ts") {
      out.push({ id: prefix, source: readFileSync(full, "utf8") })
    }
  }
  return out
}

/** Strip comments so a rule is never "satisfied" by prose describing it. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")

const ALL = findRoutes(API_DIR)
const GUARDED = ALL.filter(r => !PUBLIC_ROUTES.includes(r.id))
const HANDLERS = /\b(GET|POST|PUT|PATCH|DELETE)\b/

describe("API route contract", () => {
  it("finds the route files at all (guards against this test silently passing on nothing)", () => {
    expect(ALL.length).toBeGreaterThanOrEqual(28)
    expect(GUARDED.length).toBe(ALL.length - PUBLIC_ROUTES.length)
  })

  it("every listed public route really exists", () => {
    const ids = ALL.map(r => r.id)
    for (const pub of PUBLIC_ROUTES) expect(ids).toContain(pub)
  })

  it.each(GUARDED.map(r => r.id))("%s wraps its handlers in withAuth", id => {
    const src = code(GUARDED.find(r => r.id === id)!.source)
    expect(src).toContain('from "@/lib/withAuth"')
    // Every exported handler goes through the wrapper...
    const exported = src.match(/export const (GET|POST|PUT|PATCH|DELETE)\s*=\s*[^\n]*/g) ?? []
    expect(exported.length).toBeGreaterThan(0)
    for (const line of exported) expect(line).toContain("withAuth")
    // ...and none is left as a bare handler, which would bypass it entirely.
    const bare = src.match(/export async function (GET|POST|PUT|PATCH|DELETE)/g) ?? []
    expect(bare).toEqual([])
  })

  // user/organization GET returns name/email/organizationName/organizationLogo, which
  // withAuth does not load, so it looks the row up again by clerkId. That is the one
  // sanctioned second lookup; every other route must not need one.
  const MAY_RELOAD_OWN_ROW = ["user/organization"]

  it.each(GUARDED.map(r => r.id))("%s does not hand-roll the auth preamble", id => {
    const src = code(GUARDED.find(r => r.id === id)!.source)
    // withAuth owns the session lookup. A route calling auth() itself is a route
    // that can forget the 404, the 403, or the try/catch.
    expect(src).not.toContain("@clerk/nextjs/server")
    expect(src).not.toMatch(/await auth\(\)/)
    if (!MAY_RELOAD_OWN_ROW.includes(id)) {
      expect(src).not.toMatch(/user\.findUnique\(\{\s*where:\s*\{\s*clerkId/)
    }
  })

  it.each(GUARDED.map(r => r.id))("%s never scopes a query by dbUser.id", id => {
    const src = code(GUARDED.find(r => r.id === id)!.source)
    // The staff/owner bug in one line: dbUser.id is the STAFF member's id, so a
    // staff request would read an empty dataset instead of the owner's.
    expect(src).not.toMatch(/userId:\s*dbUser\.id/)
  })

  it.each(OWNER_ONLY)("%s is declared ownerOnly", id => {
    const route = ALL.find(r => r.id === id)
    expect(route, `${id} not found — did the route move?`).toBeDefined()
    expect(code(route!.source)).toContain("ownerOnly: true")
  })

  it("no route outside the owner-only list is accidentally ownerOnly", () => {
    const unexpected = GUARDED
      .filter(r => !OWNER_ONLY.includes(r.id))
      .filter(r => code(r.source).includes("ownerOnly: true"))
      .map(r => r.id)
    // A stray ownerOnly locks staff out of day-to-day work, which is just as
    // broken as a missing one — it is simply quieter about it.
    expect(unexpected).toEqual([])
  })

  it("the public routes stay public", () => {
    for (const id of PUBLIC_ROUTES) {
      const src = code(ALL.find(r => r.id === id)!.source)
      expect(src, `${id} must not require a session`).not.toContain("withAuth")
      if (id === "webhooks/clerk") expect(src).not.toMatch(/await auth\(\)/)
    }
  })

  it("user/staff keeps its stricter owner check instead of the ownerOnly flag", () => {
    const src = code(ALL.find(r => r.id === "user/staff")!.source)
    // ownerOnly rejects role === "staff". These handlers require role === "owner",
    // which also rejects an account that has not finished onboarding (role is null).
    // Swapping in the flag would let such an account manage staff.
    expect(src).not.toContain("ownerOnly: true")
    expect(src.match(/role !== "owner"/g)?.length).toBe(3)
  })

  it("user/organization scopes by clerkId, never effectiveUserId", () => {
    const src = code(ALL.find(r => r.id === "user/organization")!.source)
    // This route reads and writes the SIGNED-IN user's own row. Using
    // effectiveUserId would hand a staff member the owner's record.
    expect(src).not.toContain("effectiveUserId")
    expect(src).toContain("clerkId")
  })
})

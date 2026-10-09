# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Anchal Caterers is a Next.js 14 (App Router) event/catering management app with Hindi input support, recipe-to-ingredient auto-population, and print-ready layouts. Stack: TypeScript, Prisma 5 + PostgreSQL (Neon), Clerk auth, Tailwind CSS, Radix UI. Deployed on Vercel (no `vercel.json`, zero-config).

## Commands

- `npm run dev` — start dev server
- `npm run build` — runs `prisma generate` then `next build`
- `npm run lint` — `next lint`. As of 2026-10-08 it is at **zero warnings** — keep it
  there. Rules live in `.eslintrc.json`; `no-explicit-any` is off for `*.test.ts` only
  (mocks). In app code: `catch (error)` + `errorMessage(error)` / `isUniqueViolation(error)`
  from `lib/utils` (never `catch (error: any)`); event pages use `EventListRow` /
  `EventDetail` from `src/types`; fetch-on-id effects use a commented
  `eslint-disable-next-line react-hooks/exhaustive-deps` (adding fetchEvent would loop).
- `npm run test` — runs the Vitest suite once (`npm run test:watch` for watch mode). Config is `vitest.config.mts` (`.mts` extension deliberately, to avoid Vite's CJS/ESM config-loader warning without changing `package.json`'s module type). Tests live next to the code they cover (`*.test.ts`).
- The README references `npm run db:generate` / `db:push` / `db:studio` — these scripts do **not** exist in `package.json`. Use `npx prisma generate`, `npx prisma db push`, `npx prisma studio` directly instead.
- There is no `prisma/migrations` directory — schema changes are applied via `npx prisma db push`, not `prisma migrate`.

## Multiuser access control (critical)

This app has owner/staff roles (`User.role`, `User.ownerId` in `prisma/schema.prisma`). Staff accounts must see the **owner's** data, not their own. `src/lib/getEffectiveUserId.ts` resolves this:

```ts
getEffectiveUserId(dbUser) // returns dbUser.ownerId for staff, dbUser.id for owner
```

**Every API route that reads/writes user-scoped data must use `getEffectiveUserId(dbUser)` instead of `dbUser.id` directly**, or staff/owner data will leak or become isolated incorrectly.

## Auth

Clerk (`@clerk/nextjs`), wired in `src/middleware.ts` (note: middleware lives at `src/`, not the app root). Public routes: `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/api/webhooks(.*)`, `/api/health(.*)`, `/api/calendar/feed(.*)`; everything else requires `auth().protect()`. `src/app/api/webhooks/clerk/route.ts` syncs Clerk `user.created/updated/deleted` events into the Prisma `User` table by `clerkId` — must stay public. The middleware matcher excludes `.docx`/`.xlsx`/`.csv`/`.zip` extensions, which matters since the app generates Word/Excel exports (`docx`, `exceljs`).

## Workflow

- Git: no fixed rule — small fixes commit directly to `main`; larger changes get a branch/PR. Match whichever the change size calls for.
- `.env` holds `NEXT_PUBLIC_CLERK_*`, `CLERK_SECRET_KEY`, `DATABASE_URL` — no `.env.example` exists, so the README's env var list is the de facto template.
- `.github/workflows/backup.yml` runs a weekly `pg_dump` backup of `DATABASE_URL` — not a build/test CI, don't expect it to catch regressions.


# Anchal Caterers — Project Context & Decision History

This file carries the *reasoning* behind the codebase — not just what the code
does, but WHY it's built this way, what was tried and rejected, and what the
owner's actual preferences are. Read this before proposing changes so you don't
re-suggest something already deliberately rejected.

---

## What this project actually is

Anchal Caterers is a production system for a real catering business (the owner is
the developer's uncle). Before this app, the entire operation ran on paper and
WhatsApp: menus, ingredient purchasing, billing, payment tracking. This app
replaces that.

The business caters real events — weddings and functions — for anywhere from a
few hundred to a few thousand guests. Every design decision serves an operator
who uses this daily to run actual events. This is NOT a demo or portfolio piece;
if billing breaks, a real person can't invoice a real wedding.

**Stack:** Next.js 14 (App Router), TypeScript, Prisma, Neon Postgres, Clerk
auth, SWR, Tailwind. Deployed on Vercel. Commit to main = deploy to production.

---

## The core domain insight (most important thing to understand)

**One booking is not one meal.** A single wedding booking might be:
- Breakfast on the 20th for 100 guests
- Dinner on the 21st for 200 guests
- Breakfast again on the 21st for 200 guests

Each of these ("sub-events" or "meals") has its own menu, its own guest count,
its own per-plate price — but they're all ONE customer, ONE bill, ONE
procurement run. Modeling this correctly was most of the engineering.

### How meals are modeled (and why)

A "meal" / "sub-event" is NOT a stored database entity. It is a **grouping** of
`EventItem` rows by the composite key `${mealLabel}::${mealDate}`.

`EventItem` carries: `mealLabel`, `mealDate`, `mealGuests`, `mealPerPlate`.
A meal is computed by grouping items on (label + date).

**REJECTED design — parent/child Event rows.** The first version modeled a
wedding as a parent Event with child Event rows for each meal, linked by foreign
key. It was torn out because:
- Every query needed a join or recursive fetch
- The billing page had to decide whether to bill the parent or the children
- "Total for this booking" meant summing children
- Half the parent's fields were meaningless (a parent has no guest count)
- Deleting the last child left an orphaned parent that was neither booking nor meal

The realization: a sub-event has no organizer, phone, venue, or bill of its own —
it inherits all of that. The ONLY things unique per meal are: which items, which
date, how many guests, what price. That's four fields. Four scalar fields is an
*attribute*, not an *entity*. So meal identity was pushed down onto the EventItem
join table, and "meal" became a projection you compute, not a row you store.

**Do not reintroduce parent/child events.** The trade-offs were considered and
this is the deliberate choice. The known cost (meal metadata duplicated across a
meal's items, updated via updateMany) is accepted and is cheap at these row counts.

**DEFERRED (2026-09-27): a separate `Meal` table (Event → Meal → EventItem).**
Proposed as a fix for slow menu editing. It was NOT the cause — the slowness was
network round trips (see "Menu editing speed" below), and a Meal table would need
the same number of them. The refactor touches ~25 files / ~300 references and needs
a live-data migration on billing-critical rows, for a structural (not speed)
benefit. Don't propose it as a performance fix. If ever done, do it as its own
project on a branch, with a DB backup first.

### Venue is the procurement boundary

One `Event` = one venue. A wedding with functions at home AND at a wedding hall is
TWO events for the same organizer (same phone number), because the material goes to
two different places. Ingredients/procurement are always per event — never merge
ingredients across events. When the customer wants everything together, combine at
the OUTPUT level (combined menu download, one bill covering several events), not in
the data.

---

## Event date logic

`Event.functionDate` = the EARLIEST sub-event date. This is enforced consistently:
- On creation: functionDate is set to the earliest meal date (meals are sorted,
  earliest taken) — NOT the first meal the user happened to type.
- On any edit (add/remove item, edit meal date, delete meal): functionDate is
  recalculated to the earliest remaining sub-event date.

Why: the history and menu list pages show "Event Date" as a column and sort by
it ascending, so the operator sees the next upcoming event first. If functionDate
were just "the first meal entered," the sort would be wrong. Earliest-date is the
only consistent rule.

---

## The "cost changes by guest count" feature (per-plate pricing)

**Why it exists:** In real catering, the price is per-plate × guest count, and
the guest count is an estimate that changes. The owner needed the total to
recompute automatically as guest numbers change per meal, and needed the printed
menu to communicate to the CLIENT that the quoted price is not fixed.

Two parts:
1. Each meal has its own `mealPerPlate` and `mealGuests`. Event total =
   sum over meals of (guests × perPlate). Recalculated whenever meals change.
2. The **"Print Menu" (menu-only) output** includes a bold footer note:
   "Price will increase as the number of guests increases / मेहमानों की संख्या
   बढ़ने पर कीमत बढ़ेगी". This is a deliberate client-facing disclaimer so the
   customer understands the quote scales with final headcount. The full print
   (with ingredients, for internal/vendor use) does NOT have this note.

---

## Advance payment system

**Why it exists:** Catering runs on advances. A customer pays in installments
before the event (₹500,000 now, ₹250,000 later). The owner needs to track each
payment individually (date, amount, notes like "cash"/"UPI") AND see the running
total and remaining balance at a glance.

**Design:**
- `AdvancePayment` table holds individual payment rows (amount, paidDate, notes).
- `Event.advancePayment` is a CACHED total.
- CRITICAL: the cached total is updated ONLY inside the same database transaction
  that creates or deletes a payment row, and it is always recomputed as
  SUM(all remaining payment rows). See advance-payments/route.ts — the POST and
  DELETE both use `prisma.$transaction`, create/delete the row, re-sum, and
  update Event.advancePayment atomically.

This is CORRECT and deliberate. It was reviewed for the "two sources of truth
desync" problem and passes: the cache can't drift from the rows because they only
ever change together in one transaction. **Do not "simplify" this by updating
advancePayment independently** — that would reintroduce the desync bug. If you
ever change it, either keep the transactional sync or make it fully derived
(SUM on read); never a half-measure.

Remaining balance = totalAmount − advancePayment, shown on the history detail
page and in the history list "Advance" column (with a "remaining" sub-line).

---

## Owner / Staff access control

**Why it was needed:** The owner's staff need to use the app for day-to-day work
(setting menus, ingredient quantities) but must NOT see billing, revenue
analytics, or procurement costs — that's the owner's private financial data.

**Design — a "star" model:**
- User has `role` ("owner" | "staff") and a self-referential `ownerId`.
- One helper, `getEffectiveUserId(dbUser)`: returns `ownerId` for staff, own `id`
  for owner. Staff transparently read the owner's data.
- EVERY data-scoped API route uses `getEffectiveUserId` instead of `dbUser.id`
  (~20 routes). This made the change mechanical, not per-route judgement — one
  concept applied uniformly, so there's one place to get ownership right instead
  of 20 places to get it wrong (a data leak if wrong).

**Defence in depth (hiding a nav link is NOT access control):**
- Navbar hides Billing and Settings for staff.
- Billing/revenue/procurement/category-payment APIs return **403** for staff
  server-side — typing the URL directly gets nothing.
- The advance-payment data is stripped from the history table for staff AND from
  the CSV/Excel export. (Caught a bug where the column was hidden in the UI but
  still written to CSV — "a permission enforced on only one exit path isn't a
  permission." Every data exit must enforce it.)
- Event History "Select / चुनें" mode is open to staff (for the combined menu
  download), but everything money-related in it stays owner-only: the ₹ total,
  the "already billed" line, and the Create Bill button.

**Onboarding flow:** New user picks Owner or Staff. Owner names their business,
gets full access. Staff lands on a waiting screen until the owner adds their
email in Settings → Staff Management (which sets their ownerId). Staff see the
owner's organization name in the navbar (fetched via ownerId), not a blank.

**Gotcha that caused an infinite redirect loop:** dashboard/page.tsx had
`if (!organizationName) redirect("/onboarding")`. Staff have no organizationName
(they inherit the owner's), so they bounced dashboard→onboarding→dashboard
forever. Fix: exclude staff from that redirect, and use window.location.replace
(hard nav) not router.push (soft nav kept the component mounted and hammered the
API). Routing decisions like "does this user need onboarding" should live in ONE
place (layout/middleware), not scattered in page files where a new user type
silently breaks an old assumption.

---

## UI preference: TABLES, not cards

**The rule:** The list pages (event history, event menu) are DENSE TABLES, not
card grids. Sorted by event date ascending.

**Why — and this is a real stated preference, do not revert it:** The owner opens
these pages every single day. He is not browsing; he is SCANNING — checking which
events are coming up, which are unpaid, which still need ingredient quantities
set. He needs to compare rows against each other. Cards force scrolling and
holding state in your head; a table lets you scan a column.

**REJECTED: card layout.** Cards looked "clean and modern" but wasted space and
were wrong for a daily-use scanning tool. The lesson the owner taught: "beauty is
for first-time visitors; density is for daily operators." When he said the cards
"wasted space," he wasn't asking for a different look — he was saying the tool was
wrong. Don't propose cards for these list pages again.

History table columns: Event Date, Organizer + eventId, Phone, Home Address,
Venue Location, Meals/Sub-Events (per-meal date + guests), Items count, Menu
Created, Status, Payment status, Advance (hidden for staff). Menu list is similar
with a Pending/Ready status.

---

## Two addresses: Home + Venue

Events have BOTH `homeAddress` (organizer's home — "घर का पता") and `location`
(the venue — "कार्यक्रम स्थल"). Both are displayed across the app (history detail,
menu detail, list tables, print, Word, Excel) and both are editable in the
history detail edit mode. `location` is the original field (venue); `homeAddress`
was added later as nullable (added as a new column, NOT by renaming location —
additive migrations don't break running data).

Hindi labels are intentional and must be preserved:
"Home Address / घर का पता", "Venue Location / कार्यक्रम स्थल".

---

## Copy Event feature

**Why:** Caterers repeat menus. A new booking often reuses a past event's menu and
ingredient quantities. But the operator fills the NEW event's details manually
(organizer, phone, addresses, dates) — only the menu and ingredient quantities
are copied.

**Enhanced version — per-meal selection:** The copy dialog lists all the source
event's meals with checkboxes. You pick WHICH meals to copy. Each selected meal
has an editable "Copy as" meal-type dropdown (e.g. copy a Dinner but relabel it
Breakfast), plus date/guests/perPlate. So you can copy just the Lunch from an
event that had Lunch + Dinner, and relabel/re-date it.

**Shared ingredient handling (partial copy):** When you copy only some meals,
ingredients shared with the NOT-copied meals have quantities that were sized for
more meals — so they're flagged for review. This flag uses `status: "shared"`,
NOT notes (see below). The flag shows as an amber ⚠️ banner on the ingredient
card on the Event Menu page, and clears the moment the user edits that quantity.
Ingredients used ONLY by non-copied meals are simply not copied. No auto-recalc —
catering consumption isn't linear (you don't use half the oil for half the
guests), so only the human sets the right number.

**Gotcha:** the meal-key date format must match on both sides. Use
`ei.mealDate.toISOString().split("T")[0]` in the API. A mismatch made copy silently
copy nothing.

---

## Shared ingredient flag: status, NOT notes

**REJECTED: writing "⚠️ Shared with [dinner, breakfast]" into the `notes` field.**

Why rejected: `notes` is a DOMAIN field, not a UI field. It holds packing
instructions that get PRINTED on the vendor's sheet (e.g. "25kg for bhaji box,
100kg separate"). Stuffing UI warnings into notes polluted the vendor printout
with internal app state.

Correct approach: use the existing `status` field (which already had
new/removed/normal) and add `"shared"`. Notes stay clean, print stays clean, the
warning renders as a card banner. Principle: application state and domain data
never share a column.

---

## Ingredient "notes" field — what it's really for

`notes` on EventIngredient holds real-world PACKING/PREP instructions for the
vendor, printed on their sheet. The origin story ("bhaji box problem"):
aggregating a menu into total ingredients is LOSSY. The system said "125kg burfi"
but 25kg of that goes into compartmentalized bhaji boxes and 100kg is packed
loose — the vendor couldn't tell from the total. The notes field lets the operator
write "25kg for bhaji box, 100kg separate" so the arithmetically-correct total
becomes operationally usable. Notes print in AMBER next to the ingredient.

This is why notes must never be polluted with app-internal warnings.

---

## Ingredient / category ranking (sortOrder)

Ingredient CATEGORIES have a `sortOrder` rank (set in the inventory page).
Individual ingredients do NOT have their own rank. Everywhere ingredients are
displayed (history detail, menu detail, print, Word, Excel, categories-print),
they are sorted by: category sortOrder ASC, then ingredient name alphabetically.

So a category ranked 1 (e.g. Ration) shows before a category ranked 2 (e.g.
Dairy), and within each category ingredients are alphabetical. This ordering must
be consistent across ALL display and export surfaces. The event detail API must
select `category.sortOrder` for both items and ingredients so the frontend can
sort.

### Menu item order — arranged per meal (drag & drop), added 2026-10-07

Two layers. (1) Menu-item CATEGORY rank (inventory page rank box — removed in
4830419, brought back 2026-10-07) sets the DEFAULT order of every meal nobody has
arranged. New item categories are created at the BOTTOM (max rank + 1), not 0 — 0
sorts first. (2) Per meal, the operator can drag items into order on the event
history detail page, which overrides the rank for that meal only (changing a rank
later does not reshuffle arranged meals). Drag & drop lives in
(`MealItemsGrid`, `@dnd-kit`). The order is stored per item in
`EventItem.position` (nullable, 1 = first; additive column).

- Sort rule (ONE function, `compareByPositionThenCategory` in `lib/mealGroups.ts`,
  used by history page, print, Word and Excel): arranged items first by
  `position`; never-arranged items after them by category sortOrder, then name. So
  old events print exactly as before, and an item added later lands at the end.
- Save route `PUT /api/events/[eventId]/item-order` takes ONE meal's COMPLETE item
  list in the new order. It rejects ids from another meal/event (can't move an item
  across meals) and returns 409 if the meal changed since the page loaded. Writes
  all positions in ONE raw `UPDATE ... unnest` (one round trip, not one per item).
- Copy Event carries `position` over, so a copied meal keeps its arranged order.

---

## Meal ordering

Everywhere meals are listed (detail pages, list tables, print, Word, Excel):
sort by meal DATE ascending first, then by meal type in this fixed order:
breakfast(1), brunch(2), lunch(3), high-tea(4), snacks(5), dinner(6).

So two meals on the same day show breakfast before dinner; meals on different
days show earliest date first.

---

## Print / Export system (this is the actual product for the vendor & client)

Print output is not a nice-to-have — the printed ingredient sheet goes to the
vendor, the printed menu goes to the client. It's the interface between the
software and the physical world.

### Print (PDF via browser print)
- Two buttons: **Print** (full — includes ingredients, for internal/vendor use)
  and **Print Menu** (menu only — excludes ingredients, adds the client-facing
  "price increases with guests" footer note).
- Print CSS lives in **globals.css ONLY**. Inline `<style>` tags in components
  caused hydration errors (server escapes quotes as &quot;, client uses ", React
  sees a mismatch). Never put `<style>` in a component.
- Uses `@page { margin: 0 }`, `break-inside: avoid`, print-color-adjust so
  backgrounds survive. Edge-to-edge, page-break-aware.
- Ingredient layout in print: single flowing 4-COLUMN GRID, column-first fill
  order. REJECTED: a separate table per category — the owner wanted one
  continuous grid like the PDF, validated by printing pages and marking gaps with
  a pen.
- Ingredient packing notes print in amber after the name (they were once silently
  dropped from the PDF). Long names WRAP inside their box — never cut off with "…".

### PDF is the reference layout for Word and Excel
The owner judges Word/Excel against the PDF print. Their sizes are derived from
the PDF's print-only markup (event-history/[eventId]/page.tsx): at 100% print,
1 CSS px = 0.75pt (docx half-points = px × 1.5). Organizer 15pt, details 9pt
black, meal/section headings 10.5pt bold, menu items 10pt bold, ingredients 9pt,
notes 7.5pt, footer 10pt bold. Font Arial (PDF is Inter → system sans-serif).
A4, 0.23" margins, tables fill the page width. Ingredient tables have a BLACK
outline (the PDF's 1px black), not faint grey — the owner asked for this
explicitly. If the PDF print changes, update both exports to match.

### Word (.docx via `docx` library)
- Real Word tables (so structure survives copy-paste into Word, unlike PDF→Word
  which flattens to a text stream).
- mode=full and mode=menuOnly, mirroring the print buttons.
- Ingredient cell layout: 4 ingredient blocks across, each block = TWO columns:
  name+note (left, left-aligned) and quantity (right, right-aligned), with the
  border between them hidden so each pair reads as one cell. Fixed column widths
  so cells stay even. (An earlier tab-stop approach made cells uneven — rejected.)
- Note in AMBER next to name; quantity bold.
- Packer.toBuffer returns a Node Buffer — wrap in `new Uint8Array(buffer)` before
  passing to NextResponse, or it errors.

### Excel (.xlsx via `exceljs`)
- Chosen over Markdown because the owner wanted something EDITABLE with real
  add-row/add-column — markdown tables are painful to hand-edit, Excel is native.
- Layout mirrors the print/Word: event header, menu grid by rank, ingredient grid
  with name+note LEFT and quantity RIGHT per cell (2 columns per ingredient
  block, right-aligned qty).
- writeBuffer() result wrapped in Uint8Array for NextResponse.
- Column widths total ~100 characters (4 × name 17 + qty 8) and pageSetup is A4
  portrait, fitToWidth 1 — the old 136-wide layout spilled onto a second page.

### Combined menu (several events → one file)
Event History → Select → tick events → Download Menu ▾ (Word / Excel). The export
routes take `eventIds=a,b&mode=menuOnly`; a single `eventId` is just a list of
one, so single-event downloads run the same code unchanged. Layout is EVENT BY
EVENT (owner's choice, not one merged timeline): organizer name once, then per
event a "Venue / कार्यक्रम स्थल" heading, its details line, its meals, its notes;
price footer once at the end. Menu only — a combined request with mode=full is
rejected (400), because ingredients never cross the venue boundary. Selection is
locked to one phone number (one customer), same as billing.

### Export filenames
Auto-named `organizerName_eventDate_home.<ext>` (special chars stripped to
underscores); a combined menu is `organizerName_firstEventDate_combined_menu.<ext>`. PDF filename is browser-controlled (can't set programmatically);
only Word/Excel get the auto-name.

### Export header line
Shows: event date, Venue, Home, phone. Deliberately does NOT show meal type or
guest count in the header — those belong in the per-sub-event sections below.

### Download dropdown
The many export options (Print, Print Menu, Word, Word Menu, Excel, Excel Menu)
are consolidated into one "Download ▾" dropdown button (DownloadDropdown
component) with per-option icons (printer / blue Word / green Excel), instead of
6 separate buttons cluttering the toolbar.

---

## Delete confirmation

All delete/remove actions across the app use a reusable `<ConfirmProvider>` +
`useConfirm()` hook (styled modal), NOT the native browser `confirm()`. The
provider wraps the dashboard layout's children. Pattern:
`const ok = await confirm({title, description}); if (!ok) return`.
Zero native confirm() should remain. The item and ingredient deletes in the
inventory page originally had NO guard at all — that was the reported bug that
kicked off this work.

- The confirm box is built on **Radix Dialog** so it stacks on top of other Radix
  dialogs. The original plain-div overlay had its clicks blocked by the open
  dialog underneath, so "Delete" fell THROUGH to whatever was behind it (it added
  a wrong menu item in Modify Menu Items; it also broke deleting a payment inside
  Record Payment). Don't revert it to a hand-made overlay.
- Where NOT to confirm: inside Modify Menu Items. The owner's rule — adding and
  removing in a pick/unpick list should be equally easy; confirmation belongs to
  removals made OUTSIDE such a list (e.g. the ✕ on a menu-item chip on the event
  page, deleting a whole meal).

---

## Menu editing speed (Modify Menu Items)

Modify Menu Items used to save + reload the whole event on EVERY tick (3 requests,
~15 sequential DB round trips per click) — seconds per click. It now works like
Add Meal: ticks/unticks stay on screen, and closing the dialog saves them all in
ONE request (adds + removes together), then reloads once.
- Closing in ANY way (Done, ✕, Esc, outside click) saves — before, every click
  was saved instantly, so nothing was ever lost on close; this keeps that promise.
  "Discard changes" is the only way to throw them away.
- The PUT returns `addedIngredientIds` (for the green "new" highlight), replacing
  a separate recipe request per item.
- Total and functionDate are recomputed from ONE read and saved in ONE write.

---

## Shared UI building blocks

Use these instead of writing another copy (a copy-pasted UI rule drifts — some
search boxes had a clear ✕, some didn't):
- `SearchInput` (components/shared) — magnifier + input + clear ✕. `compact` for
  tight spots, `onClear` to also close a dropdown. The Revenue Stats category
  search is deliberately different and was left alone.
- `CategoryItemPicker` (components/event-menu) — category accordion + item grid,
  with built-in search filtering, used by Add Meal and Modify Menu Items.
- Search-opened categories are DERIVED, never stored: `expanded = userOpened ||
  searchActive`. Writing search matches into the expanded list (the old inventory
  page did) leaves them open after the search is cleared. Inventory page follows
  this since 2026-10-07.
- `DownloadDropdown` — `label`, `openUp` (for bars fixed to the bottom of the
  screen), `size`.

---

## Master ingredient price — one rule, two places (2026-10-08)

An `EventIngredient` with `priceAtEvent = null` is priced at the CURRENT master
`Ingredient.ratePerUnit` (bills, revenue stats, procurement, category payments all
use `priceAtEvent ?? ratePerUnit`). So writing `ratePerUnit` directly would
silently re-price every past event. A master change must first LOCK those null rows
at the OLD price, then change the master — `setMasterPrice` in
`lib/masterPrice.ts`, always inside `prisma.$transaction`.

Two entry points use it: Update Prices with no dates (`bulk-price-update`) and the
Edit Ingredient dialog's Price field (`PUT /api/ingredients`, optional
`ratePerUnit`; skipped when unchanged, so a name-only edit never locks events).
Date-range price changes stay in Update Prices only. Never write `ratePerUnit`
anywhere else without going through `setMasterPrice`.

**Date range = EVENT dates (2026-10-09).** Update Prices with dates sets
`priceAtEvent` on active events whose `functionDate` OR ANY meal's `mealDate` falls
in the range (it used to use `menuCreationDate`). So a 12 Aug event with a 13 Aug
meal is caught by a 13–20 Aug range. Price is per event, not per meal, so the WHOLE
event takes the new price even if only one of its meals is in range — confirmed as
the wanted behaviour; don't propose per-meal pricing for this. Range is built
in UTC (`YYYY-MM-DDT00:00Z` … `T23:59:59.999Z`) to match how dates are stored.

## Cancelled events carry no revenue AND no cost

Every revenue/cost surface leaves out `Event.status === "cancelled"`: `bills/stats`
(skips them in its loop) and `procurement` (filters them in the query, so the pie,
totals, event count and vendor unpaid list all exclude them). Counting a cancelled
event's cost but not its revenue would show an invented loss. Any new cost/revenue
route must apply the same filter.

## Google Calendar feed (owner only, 2026-10-08)

The owner subscribes Google Calendar (Other calendars → From URL) to a private .ics
link shown in Settings. One all-day entry per MEAL (composite meal key), cancelled
events left out, NO money in the feed. Builder: `lib/calendarFeed.ts`.

- `GET /api/calendar/feed/<ownerId>-<token>.ics` is PUBLIC (Google has no Clerk
  session); the token = HMAC(`CALENDAR_FEED_SECRET`, userId) is the only guard.
  Changing that env var revokes every old link. Missing env var → 503.
- `GET /api/calendar/link` (ownerOnly) hands the owner the path. Staff never get it.
- Google refreshes subscribed calendars on its own schedule (~8–24h); can't be sped
  up. Instant sync (Google Calendar API + OAuth) was considered and rejected as too
  many new failure points for a live billing app.
- Neon compute: `Cache-Control: s-maxage=3600` lets Vercel's CDN answer repeat
  fetches for an hour without waking the DB.

## Bill status vs paidAmount (known design debt — the "green bar" bug)

The revenue chart showed a bill as fully paid (green bar) when it was marked
unpaid. Root cause: `updateBillStatus` set `status: "unpaid"` but left
`paidAmount` at its old non-zero value. The chart trusts paidAmount, the badge
trusts status — two representations of one truth, disagreeing.

Fix applied: marking a bill unpaid now also resets paidAmount to 0
(`status === "unpaid" ? { status, paidAmount: 0 } : { status }`).

This is PATCHED but is acknowledged design debt: status and paidAmount are two
views of the same fact. The fully-correct design would derive status from
paidAmount/totalAmount rather than storing it, but status is filtered on in many
queries so that's a larger migration. Rule going forward: any state transition
must reset its dependent fields.

## Page-load speed rules (2026-10-09)

In production the DB sits next to Vercel (both us-east-1, IF the Vercel function
region is iad1), so DB queries are cheap there; what costs ~0.25s each is a trip from
the browser in India to Vercel. Count browser requests per page.
- **Signed-in user in (dashboard) server components:** `getDashboardUser()`
  (`lib/getDashboardUser.ts`, React `cache()`). `currentUser()` is an HTTP call to
  Clerk and is NOT cached by Clerk — never call it directly in a layout/page again,
  or /dashboard goes back to two Clerk calls per load.
- **Role / business name in client pages:** `useCurrentUser()` from
  `components/shared` (filled by the (dashboard) layout). Don't fetch
  `/api/user/organization` just for the role. UI only — APIs still enforce
  ownerOnly. Settings and onboarding still fetch it (they need the full row / sit
  outside the layout).
- **Font:** Inter via `next/font/google` in `app/layout.tsx` (sets `--font-inter`).
  No `@import` of Google Fonts in globals.css — it blocked first paint.
- **Event History detail** shows the copy last loaded in this tab instantly, then
  refreshes (module-level `eventCache`, keyed viewer + event). Deliberately NOT done
  on the Event Menu detail page: a background refresh there would overwrite
  quantities being typed.

---

## Hard-won gotchas (things that broke, don't repeat)

1. **Composite meal key.** Grouping meals by `mealLabel` alone merged two
   same-type meals on different dates (two breakfasts collapsed into one). ALWAYS
   key by `${label}::${dateStr}`. This bug was copy-pasted across 5 files because
   the grouping logic wasn't extracted into one shared function — a business rule
   living in 5 places is 5 chances to get it wrong.

2. **Stale derived state (green bar).** Resetting one field of a derived pair
   must reset the other. See bill status/paidAmount above.

3. **Set iteration / downlevelIteration build error.** Use
   `Array.from(new Set(...))`, never `[...new Set(...)]`. And
   `for (const x of Array.from(someSet))`, never `for...of` directly on a Set.
   This broke the Vercel production build multiple times.

4. **Inline `<style>` = hydration error.** Print CSS in globals.css only.

5. **Rewriting a file to edit it broke prod.** A one-line change should produce a
   one-line diff. Adding a field to a types file by REGENERATING the whole file
   dropped `sortOrder` from three interfaces and broke the build. Edit, never
   rewrite. (This is why the owner's standing rule is: minimal targeted changes,
   comment every change with `// CHANGED:`.)

6. **Soft nav in redirect loops.** router.push kept components mounted and
   hammered the API during a redirect loop; window.location.replace forces a full
   teardown.

7. **Navigation must be a real link, or "open in new tab" breaks.** The owner
   works with many tabs open. Anything the user clicks to go somewhere is a
   `<Link>`/`<a>` (a Button that navigates uses `asChild` around the link), not an
   `onClick` with router.push/window.location. Table rows can't be links, so they
   use `navigateRow` from `src/lib/rowNav.ts` (Cmd/Ctrl/middle-click → new tab)
   and the organizer name inside the row is a real link (right-click → new tab).
   Automatic redirects (after save, role guards) are not clicks and stay as they are.

8. **Slowness here is usually round trips, not data size.** The Neon DB is in
   us-east-1; from India each query is ~0.2–0.3s. Count sequential requests and
   awaits before blaming the schema or indexes. Batch writes, run independent
   queries with Promise.all, and don't reload the whole event after every click.

---

## Standing working preferences (the owner's explicit rules)

- **Minimal, targeted changes only. Never rewrite a whole file to edit it.**
- **Comment every change with `// CHANGED:`** describing what changed.
- **Preserve Hindi ingredient/menu names EXACTLY** (Aatta, Lahsun, Pyaj, etc.)
  and the bilingual UI labels (English / Hindi).
- The owner applies patches himself and works iteratively — give exact,
  scoped find/replace changes, not sweeping rewrites.
- This is a LIVE business app with real billing. Prefer additive migrations
  (nullable new columns) over renames. Commit before risky changes.

---

## On the horizon (mentioned, not yet built)

- AI-powered ingredient prediction: learn from historical event data to estimate
  ingredient quantities/costs, moving beyond manual experience-based estimation.
  Note the domain reality: ingredient quantity in real catering is experience-
  based, not a recipe formula — it varies by event type, guest behavior, and item
  popularity. Any prediction feature must respect that it's estimation, not
  deterministic calculation.
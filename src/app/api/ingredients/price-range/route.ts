// =============================================
// PRICE UPDATE PAGE API (date range, many ingredients at once)
// =============================================
// CHANGED: new route behind /price-update. The Inventory "Update Prices" box changes
// ONE ingredient per save (search, pick, type, save, repeat). This lists every
// ingredient used by the events in a date range and saves all the new prices in
// ONE request.
//
// Same rules as bulk-price-update:
//   - events are picked by lib/priceRange (event date OR any meal date, active only)
//   - in-range events get priceAtEvent = new price; the master price is untouched...
//   - ...unless `setMaster` is ticked: then setMasterPrice (lib/masterPrice) runs
//     first, locking every unpriced event at the OLD master before changing it.
// No ownerOnly: staff may set ingredient prices (owner's decision).

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/withAuth"
import { parseMasterPrice, setMasterPrice } from "@/lib/masterPrice"
import { eventDateRange, activeEventsInRange } from "@/lib/priceRange"
import type { PriceRangeIngredient } from "@/types"

// GET ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD — affected events + their ingredients.
export const GET = withAuth(async (req: NextRequest, { effectiveUserId }) => {
  const { searchParams } = new URL(req.url)
  const range = eventDateRange(searchParams.get("startDate"), searchParams.get("endDate"))
  if (!range) {
    return NextResponse.json({ success: false, error: "Pick a start or end date (YYYY-MM-DD)" }, { status: 400 })
  }

  const events = await prisma.event.findMany({
    where: activeEventsInRange(effectiveUserId, range),
    select: { id: true, eventId: true, organizerName: true, location: true, functionDate: true },
    orderBy: { functionDate: "asc" }
  })

  const rows = events.length === 0 ? [] : await prisma.eventIngredient.findMany({
    where: { eventId: { in: events.map(e => e.id) } },
    select: {
      priceAtEvent: true,
      ingredient: {
        select: {
          id: true, name: true, unit: true, ratePerUnit: true,
          category: { select: { name: true, sortOrder: true } }
        }
      }
    }
  })

  // One row per ingredient; the price is what bills use: priceAtEvent ?? master.
  const byId = new Map<string, PriceRangeIngredient>()
  for (const r of rows) {
    const ing = r.ingredient
    const price = r.priceAtEvent ?? ing.ratePerUnit ?? 0
    const row = byId.get(ing.id)
    if (row) {
      row.minPrice = Math.min(row.minPrice, price)
      row.maxPrice = Math.max(row.maxPrice, price)
      row.eventCount++
    } else {
      byId.set(ing.id, {
        id: ing.id, name: ing.name, unit: ing.unit,
        categoryName: ing.category.name, categorySortOrder: ing.category.sortOrder,
        masterPrice: ing.ratePerUnit ?? 0,
        minPrice: price, maxPrice: price, eventCount: 1
      })
    }
  }

  // Category rank, then name — the same order as every other ingredient list.
  const ingredients = Array.from(byId.values()).sort((a, b) =>
    a.categorySortOrder - b.categorySortOrder ||
    a.categoryName.localeCompare(b.categoryName) ||
    a.name.localeCompare(b.name)
  )

  return NextResponse.json({
    success: true,
    data: {
      events: events.map(e => ({ ...e, functionDate: e.functionDate.toISOString() })),
      ingredients
    }
  })
})

// POST { startDate, endDate, changes: [{ ingredientId, newPrice }], setMaster } — save all.
export const POST = withAuth(async (req: NextRequest, { effectiveUserId }) => {
  const body = await req.json()
  const { startDate, endDate, setMaster } = body as { startDate?: string; endDate?: string; setMaster?: boolean }

  const range = eventDateRange(startDate, endDate)
  if (!range) {
    return NextResponse.json({ success: false, error: "Pick a start or end date (YYYY-MM-DD)" }, { status: 400 })
  }
  if (!Array.isArray(body.changes) || body.changes.length === 0) {
    return NextResponse.json({ success: false, error: "No price changes to save" }, { status: 400 })
  }

  // Validate every price before writing anything; one ingredient twice → last one wins.
  const prices = new Map<string, number>()
  for (const c of body.changes as { ingredientId?: unknown; newPrice?: unknown }[]) {
    const price = parseMasterPrice(c?.newPrice)
    if (typeof c?.ingredientId !== "string" || price === null) {
      return NextResponse.json({ success: false, error: "Every price must be a number 0 or more" }, { status: 400 })
    }
    prices.set(c.ingredientId, price)
  }
  const ingredientIds = Array.from(prices.keys())
  const newPrices = ingredientIds.map(id => prices.get(id)!)

  // Every ingredient must belong to this business — the raw UPDATE below and
  // setMasterPrice trust these ids.
  const owned = await prisma.ingredient.count({
    where: { id: { in: ingredientIds }, userId: effectiveUserId }
  })
  if (owned !== ingredientIds.length) {
    return NextResponse.json({ success: false, error: "Ingredient not found" }, { status: 404 })
  }

  // Events are re-picked here, not taken from the page: the range is the truth.
  const events = await prisma.event.findMany({
    where: activeEventsInRange(effectiveUserId, range),
    select: { id: true }
  })
  const eventIds = events.map(e => e.id)

  const updatedRows = await prisma.$transaction(async tx => {
    // Master first: setMasterPrice locks unpriced events at the OLD master, then
    // the in-range update below overwrites the in-range ones with the new price.
    if (setMaster === true) {
      for (let i = 0; i < ingredientIds.length; i++) {
        await setMasterPrice(tx, ingredientIds[i], effectiveUserId, newPrices[i])
      }
    }

    // One write for every (ingredient, price) pair across all in-range events.
    const count = eventIds.length === 0 ? 0 : await tx.$executeRaw`
      UPDATE "EventIngredient" AS ei
      SET "priceAtEvent" = v.price, "updatedAt" = NOW()
      FROM unnest(${ingredientIds}::text[], ${newPrices}::float8[]) AS v(ing, price)
      WHERE ei."ingredientId" = v.ing AND ei."eventId" = ANY(${eventIds}::text[])
    `

    // Price history, same shape as bulk-price-update writes (open side = sentinel date).
    await tx.ingredientPriceHistory.createMany({
      data: ingredientIds.map((ingredientId, i) => ({
        ingredientId,
        price: newPrices[i],
        startDate: startDate ? new Date(startDate) : new Date("1900-01-01"),
        endDate: endDate ? new Date(endDate) : new Date("2100-12-31")
      }))
    })

    return count
  }, { timeout: 60000 }) // a long list with setMaster runs a few queries per ingredient

  return NextResponse.json({
    success: true,
    message: `${ingredientIds.length} price${ingredientIds.length === 1 ? "" : "s"} updated in ${eventIds.length} event${eventIds.length === 1 ? "" : "s"} (${updatedRows} ingredient rows).` +
      (setMaster === true ? " Default price for new events changed too." : " Default price NOT changed.")
  })
})

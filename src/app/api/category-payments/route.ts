import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateBody } from "@/lib/validate"  // CHANGED: request body validation
import { categoryPaymentSchema } from "@/lib/schemas"
import { withAuth } from "@/lib/withAuth" // CHANGED: replaces the repeated auth/user-lookup/403/try-catch preamble

// CHANGED: both handlers are { ownerOnly: true } — the 403 each used to write by hand.
// DELETE's old check was `dbUser?.role === "staff"` on a nullable lookup, so a signed-in
// user with no DB row slipped past it entirely; withAuth 404s that case.

// POST - Mark a category as paid for an event (or multiple events)
export const POST = withAuth(async (req: NextRequest, { effectiveUserId }) => {
    const rawBody = await req.json()
    // CHANGED: schema validation (log-only until VALIDATE_ENFORCE=true)
    const check = validateBody(categoryPaymentSchema, rawBody, "POST /api/category-payments")
    if (!check.ok) return check.response
    const body = check.data as any
    const { 
      eventIds, 
      ingredientCategoryId, 
      categoryName, 
      notes 
    }: {
      eventIds: string[]
      ingredientCategoryId: string
      categoryName: string
      notes?: string
    } = body

    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: "At least one eventId is required"
      }, { status: 400 })
    }

    if (!ingredientCategoryId) {
      return NextResponse.json({
        success: false,
        error: "ingredientCategoryId is required"
      }, { status: 400 })
    }

    // CHANGED: this looped over the selected events running a findMany AND an upsert
    // for each — two round-trips per event, and "Select All Unpaid" can pick a lot of
    // them. The ingredients are now read in one query and the upserts go out as one
    // batch, which also makes marking several events paid all-or-nothing rather than
    // half-applied if one fails.
    const eventIngredients = await prisma.eventIngredient.findMany({
      where: {
        eventId: { in: eventIds },
        status: { not: "removed" },
        ingredient: { categoryId: ingredientCategoryId }
      },
      select: {
        eventId: true,
        quantity: true,
        priceAtEvent: true,
        ingredient: { select: { ratePerUnit: true } }
      }
    })

    const amountByEvent = new Map<string, number>()
    for (const ei of eventIngredients) {
      const price = ei.priceAtEvent ?? ei.ingredient.ratePerUnit ?? 0
      amountByEvent.set(ei.eventId, (amountByEvent.get(ei.eventId) || 0) + ei.quantity * price)
    }

    // One timestamp for the batch, so events marked together share a paidAt.
    const paidAt = new Date()

    const results = await prisma.$transaction(
      eventIds.map(eventId => {
        const amount = amountByEvent.get(eventId) || 0
        return prisma.categoryPayment.upsert({
          where: {
            eventId_ingredientCategoryId: {
              eventId,
              ingredientCategoryId
            }
          },
          update: {
            amount,
            paidAt,
            notes: notes || null
          },
          create: {
            eventId,
            ingredientCategoryId,
            categoryName: categoryName || "",
            amount,
            paidAt,
            notes: notes || null,
            userId: effectiveUserId
          }
        })
      })
    )

    return NextResponse.json({
      success: true,
      data: results,
      message: `Payment marked for ${results.length} event(s)`
    })
}, { ownerOnly: true })

// DELETE - Unmark a payment (remove payment record)
export const DELETE = withAuth(async (req: NextRequest, { effectiveUserId }) => {
    const { searchParams } = new URL(req.url)
    const paymentId = searchParams.get("paymentId")
    const eventId = searchParams.get("eventId")
    const ingredientCategoryId = searchParams.get("ingredientCategoryId")

    // CHANGED: this deleted by id with NO userId filter, so any signed-in owner could
    // erase another business's payment record by guessing an id — the same ownership
    // hole closed elsewhere in 77ba3a3, missed on this route. deleteMany lets the
    // userId scope live in the WHERE clause; a row that isn't yours simply isn't found.
    if (paymentId) {
      const { count } = await prisma.categoryPayment.deleteMany({
        where: { id: paymentId, userId: effectiveUserId }
      })
      if (count === 0) {
        return NextResponse.json({ success: false, error: "Payment not found" }, { status: 404 })
      }
    } else if (eventId && ingredientCategoryId) {
      const { count } = await prisma.categoryPayment.deleteMany({
        where: { eventId, ingredientCategoryId, userId: effectiveUserId }
      })
      if (count === 0) {
        return NextResponse.json({ success: false, error: "Payment not found" }, { status: 404 })
      }
    } else {
      return NextResponse.json({
        success: false,
        error: "paymentId or (eventId + ingredientCategoryId) required"
      }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: "Payment record removed" })
}, { ownerOnly: true })

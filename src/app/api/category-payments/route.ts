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

    const results = []

    for (const eventId of eventIds) {
      // Get event ingredients for this category
      const eventIngredients = await prisma.eventIngredient.findMany({
        where: {
          eventId,
          status: { not: "removed" },
          ingredient: {
            categoryId: ingredientCategoryId
          }
        },
        include: {
          ingredient: {
            select: {
              ratePerUnit: true
            }
          }
        }
      })

      const amount = eventIngredients.reduce((sum: number, ei: { priceAtEvent: number | null; quantity: number; ingredient: { ratePerUnit: number } }) => {
        const price = ei.priceAtEvent ?? ei.ingredient.ratePerUnit ?? 0
        return sum + (ei.quantity * price)
      }, 0)

      // Upsert payment record
      const payment = await prisma.categoryPayment.upsert({
        where: {
          eventId_ingredientCategoryId: {
            eventId,
            ingredientCategoryId
          }
        },
        update: {
          amount,
          paidAt: new Date(),
          notes: notes || null
        },
        create: {
          eventId,
          ingredientCategoryId,
          categoryName: categoryName || "",
          amount,
          paidAt: new Date(),
          notes: notes || null,
          userId: effectiveUserId
        }
      })

      results.push(payment)
    }

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

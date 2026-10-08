import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/withAuth" // CHANGED: replaces the repeated auth/dbUser/try-catch preamble
import { parseMasterPrice, setMasterPrice } from "@/lib/masterPrice" // CHANGED: shared with Edit Ingredient

// CHANGED: withAuth resolves the Clerk session, loads the user, derives
// effectiveUserId (the owner's id for staff) and owns the generic 500 catch.
// Access is UNCHANGED here — no ownerOnly was added, so exactly whoever could
// reach this route before still can.
export const POST = withAuth(async (req: NextRequest, { effectiveUserId }) => {
    const { ingredientId, newPrice, startDate, endDate } = await req.json()

    if (!ingredientId || newPrice === undefined) {
      return NextResponse.json({ success: false, error: "ingredientId and newPrice are required" }, { status: 400 })
    }
    // CHANGED: reject NaN / negative / non-number prices instead of saving them.
    const price = parseMasterPrice(newPrice)
    if (price === null) {
      return NextResponse.json({ success: false, error: "Price must be a number 0 or more" }, { status: 400 })
    }

    // Get current master price before any changes
    // CHANGED: findUnique -> findFirst scoped by userId, and 404 when not owned.
    // This guards BOTH the price read here and the unscoped
    // prisma.ingredient.update() in step 3 below — without it, any signed-in
    // user could read and overwrite another business's master price by id.
    const ingredient = await prisma.ingredient.findFirst({
      where: { id: ingredientId, userId: effectiveUserId },
      select: { ratePerUnit: true }
    })
    if (!ingredient) {
      return NextResponse.json({ success: false, error: "Ingredient not found" }, { status: 404 })
    }
    // CHANGED: currentMasterPrice removed — setMasterPrice reads it inside the transaction.

    let updatedCount = 0

    // Check if ANY date is provided (start OR end OR both)
    const hasDateFilter = startDate || endDate

    if (hasDateFilter) {
      // WITH DATE FILTER: Update ONLY priceAtEvent for events matching the filter
      // Master price stays unchanged
      
      // Build date filter based on what's provided
      const dateFilter: any = {}
      
      if (startDate && endDate) {
        // Both dates: events between start and end
        const startDateTime = new Date(startDate)
        startDateTime.setHours(0, 0, 0, 0)
        const endDateTime = new Date(endDate)
        endDateTime.setHours(23, 59, 59, 999)
        
        dateFilter.gte = startDateTime
        dateFilter.lte = endDateTime
        
        console.log("Date range (both):", { start: startDateTime, end: endDateTime })
      } else if (startDate) {
        // Only start date: events FROM this date onwards
        const startDateTime = new Date(startDate)
        startDateTime.setHours(0, 0, 0, 0)
        
        dateFilter.gte = startDateTime
        
        console.log("Date range (from):", { start: startDateTime })
      } else if (endDate) {
        // Only end date: events UP TO this date
        const endDateTime = new Date(endDate)
        endDateTime.setHours(23, 59, 59, 999)
        
        dateFilter.lte = endDateTime
        
        console.log("Date range (until):", { end: endDateTime })
      }

      // Find events matching the date filter
      const events = await prisma.event.findMany({
        where: {
          userId: effectiveUserId,
          status: 'active',
          menuCreationDate: dateFilter
        },
        select: { 
          id: true,
          eventId: true,
          menuCreationDate: true 
        }
      })

      console.log("Events found:", events.length, events.map(e => ({ eventId: e.eventId, menuCreationDate: e.menuCreationDate })))

      if (events.length > 0) {
        const eventIds = events.map(e => e.id)

        // Update priceAtEvent for events in range
        const result = await prisma.eventIngredient.updateMany({
          where: {
            ingredientId: ingredientId,
            eventId: { in: eventIds }
          },
          data: {
            priceAtEvent: price // CHANGED: validated value
          }
        })
        
        updatedCount = result.count
        console.log("Updated eventIngredients:", updatedCount)
      }

      // Save to price history
      await prisma.ingredientPriceHistory.create({
        data: {
          ingredientId,
          price, // CHANGED: validated value
          startDate: startDate ? new Date(startDate) : new Date('1900-01-01'),
          endDate: endDate ? new Date(endDate) : new Date('2100-12-31')
        }
      })

      // Build message based on date filter type
      let dateMessage = ""
      if (startDate && endDate) {
        dateMessage = `between ${startDate} and ${endDate}`
      } else if (startDate) {
        dateMessage = `from ${startDate} onwards`
      } else {
        dateMessage = `up to ${endDate}`
      }

      return NextResponse.json({ 
        success: true, 
        message: `Price updated for ${events.length} events ${dateMessage} (${updatedCount} ingredients affected). Master price NOT changed.`
      })

    } else {
      // NO DATE FILTER: Update master price for NEW events only
      // CHANGED: the lock-then-update steps moved to lib/masterPrice.ts (shared with the
      // Edit Ingredient dialog) and now run in ONE transaction — before, a failure
      // between "lock old events" and "change master" could leave it half done.
      const result = await prisma.$transaction(tx =>
        setMasterPrice(tx, ingredientId, effectiveUserId, price)
      )
      if (!result) {
        return NextResponse.json({ success: false, error: "Ingredient not found" }, { status: 404 })
      }

      return NextResponse.json({ 
        success: true, 
        message: `Master price updated to ₹${price}. ${result.lockedCount} existing events locked at old price ₹${result.oldPrice}. New events will use ₹${price}.`
      })
    }
})

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { getEffectiveUserId } from "@/lib/getEffectiveUserId"

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Get the database user
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true, ownerId: true }
    })
    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const { ingredientId, newPrice, startDate, endDate } = await req.json()

    if (!ingredientId || newPrice === undefined) {
      return NextResponse.json({ success: false, error: "ingredientId and newPrice are required" }, { status: 400 })
    }

    // Get current master price before any changes
    const ingredient = await prisma.ingredient.findUnique({
      where: { id: ingredientId },
      select: { ratePerUnit: true }
    })
    const currentMasterPrice = ingredient?.ratePerUnit || 0

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
          userId: getEffectiveUserId(dbUser),
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
            priceAtEvent: newPrice
          }
        })
        
        updatedCount = result.count
        console.log("Updated eventIngredients:", updatedCount)
      }

      // Save to price history
      await prisma.ingredientPriceHistory.create({
        data: {
          ingredientId,
          price: newPrice,
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
      // First, lock in current prices for ALL existing events that have null priceAtEvent
      
      // Step 1: Find all existing event ingredients with null priceAtEvent for this user
      const existingEventIngredients = await prisma.eventIngredient.findMany({
        where: {
          ingredientId: ingredientId,
          priceAtEvent: null,
          event: {
            userId: getEffectiveUserId(dbUser)
          }
        },
        select: { id: true}
      })

      console.log(`Found ${existingEventIngredients.length} event ingredients with null priceAtEvent`)

      // Step 2: Set their priceAtEvent to CURRENT master price (before we change it)
      // This "locks in" their current price
      if (existingEventIngredients.length > 0) {
        const lockedCount = await prisma.eventIngredient.updateMany({
          where: {
            id: { in: existingEventIngredients.map(ei => ei.id) }
          },
          data: {
            priceAtEvent: currentMasterPrice
          }
        })
        console.log(`Locked ${lockedCount.count} existing event ingredients at price ${currentMasterPrice}`)
      }

      // Step 3: NOW update the master price (only affects NEW events)
      await prisma.ingredient.update({
        where: { id: ingredientId },
        data: { ratePerUnit: newPrice }
      })

      return NextResponse.json({ 
        success: true, 
        message: `Master price updated to ₹${newPrice}. ${existingEventIngredients.length} existing events locked at old price ₹${currentMasterPrice}. New events will use ₹${newPrice}.`
      })
    }
  } catch (error) {
    console.error("Error updating price:", error)
    return NextResponse.json({ success: false, error: "Failed to update price" }, { status: 500 })
  }
}
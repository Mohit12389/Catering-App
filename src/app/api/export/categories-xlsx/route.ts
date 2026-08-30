import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { getEffectiveUserId } from "@/lib/getEffectiveUserId"  // CHANGED: replaces inlined role check
import ExcelJS from "exceljs"

// =============================================
// EXPORT CATEGORIES PRINT AS .XLSX
// =============================================
// GET /api/export/categories-xlsx?categoryId=xxx&startDate=xxx&endDate=xxx&boughtBy=all

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true, ownerId: true }
    })
    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const categoryId = searchParams.get("categoryId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const boughtBy = searchParams.get("boughtBy")

    if (!categoryId || !startDate || !endDate) {
      return NextResponse.json({ success: false, error: "categoryId, startDate, endDate required" }, { status: 400 })
    }

    // CHANGED: use the shared helper instead of an inlined hand-copy of it — ownership
    // resolution must live in ONE place (see getEffectiveUserId.ts / CLAUDE.md)
    const effectiveUserId = getEffectiveUserId(dbUser)

    // CHANGED: scope by userId so a caller can't read another business's category name by id
    const category = await prisma.ingredientCategory.findFirst({
      where: { id: categoryId, userId: effectiveUserId },
      select: { name: true }
    })
    const categoryName = category?.name || "Unknown"

    const events = await prisma.event.findMany({
      where: {
        userId: effectiveUserId,
        status: "active",
        functionDate: { gte: new Date(startDate), lte: new Date(endDate + "T23:59:59") }
      },
      select: {
        eventId: true, organizerName: true, phoneNumber: true,
        location: true, homeAddress: true, functionDate: true,
        eventIngredients: {
          where: { ingredient: { categoryId }, quantity: { gt: 0 } },
          select: { quantity: true, notes: true, ingredient: { select: { name: true, unit: true } } }
        },
        eventCategorySettings: {
          where: { ingredientCategoryId: categoryId },
          select: { boughtBy: true }
        }
      },
      orderBy: { functionDate: "asc" }
    })

    let filtered = events
    if (boughtBy && boughtBy !== "all") {
      filtered = events.filter(e => (e.eventCategorySettings[0]?.boughtBy || "caterer") === boughtBy)
    }
    filtered = filtered.filter(e => e.eventIngredients.length > 0)

    // =============================================
    // Build workbook
    // =============================================
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(categoryName.slice(0, 30))

    const GREEN = "FF4A7C59"
    const AMBER = "FFB45309"
    const GREY = "FF666666"
    const arial = (opts: any = {}) => ({ name: "Arial", ...opts })
    const thin = { style: "thin" as const, color: { argb: "FFCCCCCC" } }

    let rowNum = 1

    // Header
    const titleCell = ws.getCell(`A${rowNum}`)
    titleCell.value = "Anchal Caterers"
    titleCell.font = arial({ bold: true, size: 16 })
    rowNum++

    const subCell = ws.getCell(`A${rowNum}`)
    subCell.value = `${categoryName} - Ingredient List`
    subCell.font = arial({ bold: true, size: 12 })
    rowNum++

    const startFmt = new Date(startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    const endFmt = new Date(endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    const rangeCell = ws.getCell(`A${rowNum}`)
    rangeCell.value = `${startFmt} - ${endFmt}   |   ${filtered.length} events`
    rangeCell.font = arial({ size: 10, color: { argb: GREY } })
    rowNum += 2

    // Each event section
    const BLOCKS = 4 // ingredient blocks across
    filtered.forEach((event, idx) => {
      const dateFmt = event.functionDate
        ? new Date(event.functionDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
        : ""

      // Event header
      const hdrCell = ws.getCell(`A${rowNum}`)
      hdrCell.value = `${idx + 1}. ${event.organizerName}   -   ${dateFmt}`
      hdrCell.font = arial({ bold: true, size: 12 })
      rowNum++

      const contactCell = ws.getCell(`A${rowNum}`)
      contactCell.value = `Phone: ${event.phoneNumber}   |   Venue: ${event.location}${event.homeAddress ? `   |   Home: ${event.homeAddress}` : ""}`
      contactCell.font = arial({ size: 9, color: { argb: GREY } })
      rowNum++

      // Ingredients sorted alphabetically
      const ings = [...event.eventIngredients]
        .map(ei => ({ name: ei.ingredient.name, quantity: ei.quantity, unit: ei.ingredient.unit, notes: ei.notes || null }))
        .sort((a, b) => a.name.localeCompare(b.name))

      const totalRows = Math.ceil(ings.length / BLOCKS)
      for (let r = 0; r < totalRows; r++) {
        for (let b = 0; b < BLOCKS; b++) {
          const i = b * totalRows + r
          const ing = ings[i]
          if (ing) {
            const nameCol = b * 2 + 1
            const qtyCol = b * 2 + 2

            const nameCell = ws.getCell(rowNum + r, nameCol)
            const noteText = ing.notes ? ` (${ing.notes})` : ""
            nameCell.value = {
              richText: [
                { text: ing.name, font: arial({ size: 10 }) },
                ...(ing.notes ? [{ text: noteText, font: arial({ size: 9, color: { argb: AMBER } }) }] : [])
              ]
            }
            nameCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true }
            nameCell.border = { top: thin, bottom: thin, left: thin }

            const qtyCell = ws.getCell(rowNum + r, qtyCol)
            qtyCell.value = `${ing.quantity} ${ing.unit}`
            qtyCell.font = arial({ bold: true, size: 10 })
            qtyCell.alignment = { horizontal: "right", vertical: "middle" }
            qtyCell.border = { top: thin, bottom: thin, right: thin }
          }
        }
      }
      rowNum += totalRows + 1 // gap after event
    })

    // Column widths (4 blocks × 2 cols each)
    for (let b = 0; b < BLOCKS; b++) {
      ws.getColumn(b * 2 + 1).width = 22 // name
      ws.getColumn(b * 2 + 2).width = 12 // qty
    }

    // Generate
    const buffer = await wb.xlsx.writeBuffer()
    const uint8 = new Uint8Array(buffer)
    const safe = (s: string) => (s || "").replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "")
    const filename = `${safe(categoryName)}_${startDate}_to_${endDate}.xlsx`

    return new NextResponse(uint8, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    })
  } catch (error) {
    console.error("Error exporting categories xlsx:", error)
    return NextResponse.json({ success: false, error: "Failed to export" }, { status: 500 })
  }
}
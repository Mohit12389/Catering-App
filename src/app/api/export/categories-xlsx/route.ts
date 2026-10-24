import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/withAuth" // CHANGED: replaces the repeated auth/dbUser/try-catch preamble
import ExcelJS from "exceljs"
import { noteLines } from "@/lib/utils" // CHANGED: one grid cell per category-note line

// =============================================
// EXPORT CATEGORIES PRINT AS .XLSX
// =============================================
// GET /api/export/categories-xlsx?categoryId=xxx&startDate=xxx&endDate=xxx&boughtBy=all

// CHANGED: withAuth resolves the session, loads the user and hands over
// effectiveUserId (the owner's id for staff) already resolved.
export const GET = withAuth(async (req: NextRequest, { effectiveUserId }) => {
    const { searchParams } = new URL(req.url)
    const categoryId = searchParams.get("categoryId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const boughtBy = searchParams.get("boughtBy")

    if (!categoryId || !startDate || !endDate) {
      return NextResponse.json({ success: false, error: "categoryId, startDate, endDate required" }, { status: 400 })
    }

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
          select: { boughtBy: true, notes: true } // CHANGED: + category note
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

    const AMBER = "FFB45309"
    const arial = (opts: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({ name: "Arial", ...opts }) // CHANGED: was any

    // CHANGED: sizes, borders, column widths and page setup copied from the Event History
    // Excel export (event-xlsx), which mirrors the PDF print (1 CSS px = 0.75pt).
    const SZ = { title: 15, details: 9, heading: 10.5, ing: 9, ingNote: 8 }
    const BLOCKS = 4 // ingredient blocks across
    const LAST_COL = BLOCKS * 2 // columns A..H (4 blocks × name|qty)
    const line = (argb: string, style: "thin" | "medium" = "thin") => ({ style, color: { argb } })
    const ING_LINE = line("FF000000")     // PDF ingredient grid: 1px black
    const HEADING_LINE = line("FFD1D5DB") // PDF section headings: thin grey underline
    const ruleUnder = (row: number, border: ReturnType<typeof line>) => {
      for (let c = 1; c <= LAST_COL; c++) {
        const cell = ws.getCell(row, c)
        cell.border = { ...(cell.border || {}), bottom: border }
      }
    }
    const fmt = (d: string | Date) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })

    let rowNum = 1

    // Header — like the PDF: title, details line, 2px black rule
    const titleCell = ws.getCell(`A${rowNum}`)
    titleCell.value = `Anchal Caterers — ${categoryName} - Ingredient List`
    titleCell.font = arial({ bold: true, size: SZ.title })
    rowNum++

    const rangeCell = ws.getCell(`A${rowNum}`)
    rangeCell.value = `${fmt(startDate)} - ${fmt(endDate)}   |   ${filtered.length} events`
    rangeCell.font = arial({ size: SZ.details })
    ruleUnder(rowNum, line("FF000000", "medium"))
    rowNum += 2

    // Each event section
    filtered.forEach((event, idx) => {
      const hdrCell = ws.getCell(`A${rowNum}`)
      hdrCell.value = `${idx + 1}. ${event.organizerName}`
      hdrCell.font = arial({ bold: true, size: SZ.heading })
      ruleUnder(rowNum, HEADING_LINE)
      rowNum++

      const contactCell = ws.getCell(`A${rowNum}`)
      contactCell.value = [
        event.functionDate ? fmt(event.functionDate) : "",
        event.location ? `Venue: ${event.location}` : "",
        event.homeAddress ? `Home: ${event.homeAddress}` : "",
        event.phoneNumber
      ].filter(Boolean).join("  |  ")
      contactCell.font = arial({ size: SZ.details })
      rowNum++

      // Ingredients alphabetically, filled top-to-bottom like the PDF grid.
      const ings = event.eventIngredients
        .map(ei => ({ name: ei.ingredient.name, quantity: ei.quantity, unit: ei.ingredient.unit, notes: ei.notes || null }))
        .sort((a, b) => a.name.localeCompare(b.name))

      const totalRows = Math.ceil(ings.length / BLOCKS)
      for (let r = 0; r < totalRows; r++) {
        for (let b = 0; b < BLOCKS; b++) {
          const c = ings[b * totalRows + r]
          const nameCol = b * 2 + 1
          const qtyCol = b * 2 + 2

          if (c) {
            const nameCell = ws.getCell(rowNum + r, nameCol)
            nameCell.value = {
              richText: [
                { text: c.name, font: arial({ size: SZ.ing }) },
                ...(c.notes ? [{ text: ` (${c.notes})`, font: arial({ size: SZ.ingNote, color: { argb: AMBER } }) }] : [])
              ]
            }
            nameCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true }

            const qtyCell = ws.getCell(rowNum + r, qtyCol)
            qtyCell.value = `${c.quantity} ${c.unit}`
            qtyCell.font = arial({ bold: true, size: SZ.ing })
            qtyCell.alignment = { horizontal: "right", vertical: "middle" }
          }
          // Black 1px outline on EVERY block — empty ones too — so the grid reads as one
          // closed table. No line between name and quantity.
          ws.getCell(rowNum + r, nameCol).border = { top: ING_LINE, bottom: ING_LINE, left: ING_LINE }
          ws.getCell(rowNum + r, qtyCol).border = { top: ING_LINE, bottom: ING_LINE, right: ING_LINE }
        }
      }
      rowNum += totalRows

      // CHANGED: category note in its OWN 2-column table right under the ingredient grid
      // (one cell per line, amber, filled top-to-bottom), so long notes never stretch the
      // ingredient rows. Each half = 4 columns (A–D, E–H) merged. Excel won't grow a merged
      // row by itself, so long notes get a taller row (~60 characters per line at 8pt).
      const notes = noteLines(event.eventCategorySettings[0]?.notes)
      const NOTE_COLS = 2
      const noteSpan = LAST_COL / NOTE_COLS
      const noteRows = Math.ceil(notes.length / NOTE_COLS)
      for (let r = 0; r < noteRows; r++) {
        let lines = 1
        for (let c = 0; c < NOTE_COLS; c++) {
          const text = notes[c * noteRows + r] || ""
          const first = c * noteSpan + 1
          const last = first + noteSpan - 1
          ws.mergeCells(rowNum + r, first, rowNum + r, last)
          const noteCell = ws.getCell(rowNum + r, first)
          noteCell.value = text
          noteCell.font = arial({ size: SZ.ingNote, color: { argb: AMBER } })
          noteCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true }
          for (let col = first; col <= last; col++) {
            ws.getCell(rowNum + r, col).border = {
              top: ING_LINE, bottom: ING_LINE,
              ...(col === first ? { left: ING_LINE } : {}),
              ...(col === last ? { right: ING_LINE } : {})
            }
          }
          lines = Math.max(lines, Math.ceil(text.length / 60))
        }
        if (lines > 1) ws.getRow(rowNum + r).height = lines * 11 + 2
      }
      rowNum += noteRows + 1 // gap after event
    })

    // Column widths: 4 × (17 + 8) = 100 character-widths ≈ an A4 portrait page
    for (let b = 0; b < BLOCKS; b++) {
      ws.getColumn(b * 2 + 1).width = 17 // name
      ws.getColumn(b * 2 + 2).width = 8  // qty
    }

    // Print setup — A4 portrait, the PDF's narrow margins, always one page wide
    ws.pageSetup = {
      paperSize: 9, orientation: "portrait",
      fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.23, right: 0.23, top: 0.23, bottom: 0.23, header: 0, footer: 0 }
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
})

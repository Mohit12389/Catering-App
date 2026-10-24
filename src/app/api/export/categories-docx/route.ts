import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/withAuth" // CHANGED: replaces the repeated auth/dbUser/try-catch preamble
import { noteLines } from "@/lib/utils" // CHANGED: one grid cell per category-note line
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, WidthType, AlignmentType, BorderStyle,  // CHANGED: - unused ShadingType
  TableLayoutType
} from "docx"

// =============================================
// EXPORT CATEGORIES PRINT AS .DOCX
// =============================================
// GET /api/export/categories-docx?categoryId=xxx&startDate=xxx&endDate=xxx&boughtBy=all

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

    // Get category name
    // CHANGED: scope by userId so a caller can't read another business's category name by id
    const category = await prisma.ingredientCategory.findFirst({
      where: { id: categoryId, userId: effectiveUserId },
      select: { name: true }
    })
    const categoryName = category?.name || "Unknown"

    // Fetch events with ingredients in this category
    const events = await prisma.event.findMany({
      where: {
        userId: effectiveUserId,
        status: "active",
        functionDate: {
          gte: new Date(startDate),
          lte: new Date(endDate + "T23:59:59")
        }
      },
      select: {
        eventId: true, organizerName: true, phoneNumber: true,
        location: true,homeAddress: true, functionDate: true,
        eventIngredients: {
          where: { ingredient: { categoryId }, quantity: { gt: 0 } },
          select: {
            quantity: true, notes: true,
            ingredient: { select: { name: true, unit: true, category: { select: { sortOrder: true } } } }
          }
        },
        eventCategorySettings: {
          where: { ingredientCategoryId: categoryId },
          select: { boughtBy: true, notes: true } // CHANGED: + category note
        }
      },
      orderBy: { functionDate: "asc" }
    })

    // Filter by boughtBy
    let filtered = events
    if (boughtBy && boughtBy !== "all") {
      filtered = events.filter(e => {
        const setting = e.eventCategorySettings[0]
        return (setting?.boughtBy || "caterer") === boughtBy
      })
    }
    filtered = filtered.filter(e => e.eventIngredients.length > 0)

    // =============================================
    // Build document
    // =============================================
    // CHANGED: sizes, borders and margins copied from the Event History Word export
    // (event-docx), which mirrors the PDF print: 1 CSS px = 0.75pt, docx size = px × 1.5,
    // Arial, A4 with 0.23in margins, tables the full page width, black ingredient outline.
    const PAGE_MARGIN = 330
    const CONTENT_W = 11906 - 2 * PAGE_MARGIN
    const SZ = { title: 30, details: 18, heading: 21, ing: 18, ingNote: 16 }
    const ingBorder = { style: BorderStyle.SINGLE, size: 6, color: "000000" }
    const headingRule = { style: BorderStyle.SINGLE, size: 6, color: "D1D5DB" }
    const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
    const cellMargins = { top: 15, bottom: 15, left: 60, right: 60 }
    const fmt = (d: string | Date) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    const docChildren: (Paragraph | Table)[] = []

    // Header — like the PDF: title, details line, 2px black rule
    docChildren.push(new Paragraph({
      children: [new TextRun({ text: `Anchal Caterers — ${categoryName} - Ingredient List`, bold: true, size: SZ.title })],
      spacing: { after: 30 }
    }))
    docChildren.push(new Paragraph({
      children: [new TextRun({ text: `${fmt(startDate)} - ${fmt(endDate)}`, size: SZ.details })],
      spacing: { after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "000000" } }
    }))

    // Each event: heading, details line, one 4-block ingredient grid
    filtered.forEach((event, idx) => {
      // keepNext: the heading and details never sit alone at the bottom of a page
      docChildren.push(new Paragraph({
        children: [new TextRun({ text: `${idx + 1}. ${event.organizerName}`, bold: true, size: SZ.heading })],
        spacing: { before: 90, after: 15 },
        border: { bottom: headingRule },
        keepNext: true
      }))
      docChildren.push(new Paragraph({
        children: [new TextRun({ text: [
          event.functionDate ? fmt(event.functionDate) : "",
          event.location ? `Venue: ${event.location}` : "",
          event.homeAddress ? `Home: ${event.homeAddress}` : "",
          event.phoneNumber
        ].filter(Boolean).join("  |  "), size: SZ.details })],
        spacing: { after: 30 },
        keepNext: true
      }))

      // Ingredients alphabetically, then one cell per category-note line, filled
      // top-to-bottom like the PDF grid, so the notes land at the end of the grid.
      type GridCell = { kind: "ing"; name: string; quantity: number; unit: string; notes: string | null } | { kind: "note"; text: string }
      const cellsList: GridCell[] = [
        ...event.eventIngredients
          .map(ei => ({ kind: "ing" as const, name: ei.ingredient.name, quantity: ei.quantity, unit: ei.ingredient.unit, notes: ei.notes || null }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        ...noteLines(event.eventCategorySettings[0]?.notes).map(text => ({ kind: "note" as const, text }))
      ]

      if (cellsList.length > 0) {
        const BLOCKS = 4
        const qtyColWidth = 900
        const nameColWidth = Math.floor(CONTENT_W / BLOCKS) - qtyColWidth
        const totalRows = Math.ceil(cellsList.length / BLOCKS)
        const rows: TableRow[] = []

        const columnWidths: number[] = []
        for (let b = 0; b < BLOCKS; b++) columnWidths.push(nameColWidth, qtyColWidth)

        for (let row = 0; row < totalRows; row++) {
          const cells: TableCell[] = []
          for (let b = 0; b < BLOCKS; b++) {
            const c = cellsList[b * totalRows + row]

            if (c?.kind === "note") {
              // A note owns the whole block (name + qty columns), amber like ingredient notes
              cells.push(new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: c.text, size: SZ.ingNote, color: "B45309" })] })],
                columnSpan: 2,
                width: { size: nameColWidth + qtyColWidth, type: WidthType.DXA },
                margins: cellMargins,
                borders: { top: ingBorder, bottom: ingBorder, left: ingBorder, right: ingBorder }
              }))
            } else if (c) {
              cells.push(new TableCell({
                children: [new Paragraph({
                  children: [
                    new TextRun({ text: c.name, size: SZ.ing }),
                    ...(c.notes ? [new TextRun({ text: ` (${c.notes})`, size: SZ.ingNote, color: "B45309" })] : [])
                  ]
                })],
                width: { size: nameColWidth, type: WidthType.DXA },
                margins: cellMargins,
                borders: { top: ingBorder, bottom: ingBorder, left: ingBorder, right: noBorder }
              }))
              cells.push(new TableCell({
                children: [new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: `${c.quantity} ${c.unit}`, bold: true, size: SZ.ing })]
                })],
                width: { size: qtyColWidth, type: WidthType.DXA },
                margins: cellMargins,
                borders: { top: ingBorder, bottom: ingBorder, left: noBorder, right: ingBorder }
              }))
            } else {
              cells.push(new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "", size: SZ.ing })] })],
                width: { size: nameColWidth, type: WidthType.DXA },
                margins: cellMargins,
                borders: { top: ingBorder, bottom: ingBorder, left: ingBorder, right: noBorder }
              }))
              cells.push(new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "", size: SZ.ing })] })],
                width: { size: qtyColWidth, type: WidthType.DXA },
                margins: cellMargins,
                borders: { top: ingBorder, bottom: ingBorder, left: noBorder, right: ingBorder }
              }))
            }
          }
          rows.push(new TableRow({ children: cells, cantSplit: true }))
        }

        docChildren.push(new Table({
          rows,
          width: { size: (nameColWidth + qtyColWidth) * BLOCKS, type: WidthType.DXA },
          columnWidths,
          layout: TableLayoutType.FIXED
        }))
      }
    })

    // Total summary
    if (filtered.length > 0) {
      docChildren.push(new Paragraph({
        children: [new TextRun({ text: `Total: ${filtered.length} events`, size: SZ.details })], // CHANGED: PDF details size, black
        spacing: { before: 120 },
        alignment: AlignmentType.CENTER
      }))
    }

    // Generate document
    const doc = new Document({
      styles: { default: { document: { run: { font: "Arial" } } } }, // CHANGED: Arial, like the Event History Word export
      sections: [{
        properties: {
          // CHANGED: A4 with the PDF's narrow margins, like the Event History Word export (was 0.5in)
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: PAGE_MARGIN, right: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN }
          }
        },
        children: docChildren
      }]
    })

    const buffer = await Packer.toBuffer(doc)
    const uint8 = new Uint8Array(buffer)
    const filename = `${categoryName}-${startDate}-to-${endDate}.docx`

    return new NextResponse(uint8, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    })
})

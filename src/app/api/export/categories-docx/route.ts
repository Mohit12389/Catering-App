import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, WidthType, AlignmentType, BorderStyle, ShadingType,
  TableLayoutType
} from "docx"

// =============================================
// EXPORT CATEGORIES PRINT AS .DOCX
// =============================================
// GET /api/export/categories-docx?categoryId=xxx&startDate=xxx&endDate=xxx&boughtBy=all

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

    // Get category name
    const category = await prisma.ingredientCategory.findUnique({
      where: { id: categoryId },
      select: { name: true }
    })
    const categoryName = category?.name || "Unknown"

    // Get effective userId
    const effectiveUserId = dbUser.role === "staff" && dbUser.ownerId ? dbUser.ownerId : dbUser.id

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
          select: { boughtBy: true }
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
    const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" }
    const docChildren: (Paragraph | Table)[] = []

    // Header
    docChildren.push(new Paragraph({
      children: [new TextRun({ text: "Anchal Caterers", bold: true, size: 28 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 50 }
    }))
    docChildren.push(new Paragraph({
      children: [new TextRun({ text: `${categoryName} - Ingredient List`, bold: true, size: 22 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 50 }
    }))

    const startFmt = new Date(startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    const endFmt = new Date(endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    docChildren.push(new Paragraph({
      children: [new TextRun({ text: `${startFmt} - ${endFmt}`, size: 18, color: "666666" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "333333" } }
    }))

    // Each event as a bordered section
    filtered.forEach((event, idx) => {
      const dateFmt = event.functionDate
        ? new Date(event.functionDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
        : ""

      // Event header: number + name + date
      docChildren.push(new Paragraph({
        children: [
          new TextRun({ text: `${idx + 1}. ${event.organizerName}`, bold: true, size: 20 }),
          new TextRun({ text: `     ${dateFmt}`, size: 18, color: "666666" })
        ],
        spacing: { before: 200, after: 50 }
      }))

      // Phone + location
        docChildren.push(new Paragraph({
        children: [new TextRun({ text: `📞 ${event.phoneNumber}   📍 Venue: ${event.location}${event.homeAddress ? `   🏠 Home: ${event.homeAddress}` : ""}`, size: 16, color: "666666" })],
        spacing: { after: 100 }
      }))

      // Ingredients in 4-column grid matching PDF layout
 const allIngs = event.eventIngredients
        .map(ei => ({ name: ei.ingredient.name, quantity: ei.quantity, unit: ei.ingredient.unit, notes: ei.notes || null }))
        .sort((a, b) => a.name.localeCompare(b.name))
 
      if (allIngs.length > 0) {
        const BLOCKS = 4
        const nameColWidth = 1700
        const qtyColWidth = 550
        const totalRows = Math.ceil(allIngs.length / BLOCKS)
        const rows: TableRow[] = []
 
        const columnWidths: number[] = []
        for (let b = 0; b < BLOCKS; b++) columnWidths.push(nameColWidth, qtyColWidth)
 
        for (let row = 0; row < totalRows; row++) {
          const cells: TableCell[] = []
          for (let b = 0; b < BLOCKS; b++) {
            const idx = b * totalRows + row
            const ing = allIngs[idx]
 
            if (ing) {
              const noteText = ing.notes ? ` (${ing.notes})` : ""
              cells.push(new TableCell({
                children: [new Paragraph({
                  children: [
                    new TextRun({ text: ing.name, size: 16 }),
                    ...(ing.notes ? [new TextRun({ text: noteText, size: 13, color: "B45309" })] : [])
                  ]
                })],
                width: { size: nameColWidth, type: WidthType.DXA },
                borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } }
              }))
              cells.push(new TableCell({
                children: [new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: `${ing.quantity} ${ing.unit}`, bold: true, size: 16 })]
                })],
                width: { size: qtyColWidth, type: WidthType.DXA },
                borders: { top: thinBorder, bottom: thinBorder, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: thinBorder }
              }))
            } else {
              cells.push(new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "", size: 16 })] })],
                width: { size: nameColWidth, type: WidthType.DXA },
                borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } }
              }))
              cells.push(new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "", size: 16 })] })],
                width: { size: qtyColWidth, type: WidthType.DXA },
                borders: { top: thinBorder, bottom: thinBorder, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: thinBorder }
              }))
            }
          }
          rows.push(new TableRow({ children: cells }))
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
        children: [new TextRun({ text: `Total: ${filtered.length} events`, size: 18, color: "666666" })],
        spacing: { before: 200 },
        alignment: AlignmentType.CENTER
      }))
    }

    // Generate document
    const doc = new Document({
      sections: [{
        properties: {
          page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } }
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
  } catch (error) {
    console.error("Error exporting categories docx:", error)
    return NextResponse.json({ success: false, error: "Failed to export" }, { status: 500 })
  }
}
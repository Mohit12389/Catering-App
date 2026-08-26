import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, WidthType, AlignmentType, BorderStyle, HeadingLevel,
  ShadingType, TableLayoutType, TabStopType
} from "docx"

// =============================================
// EXPORT EVENT AS .DOCX
// =============================================
// GET /api/export/event-docx?eventId=xxx&mode=full|menuOnly

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get("eventId")
    const mode = searchParams.get("mode") || "full" // "full" or "menuOnly"

    if (!eventId) {
      return NextResponse.json({ success: false, error: "eventId required" }, { status: 400 })
    }

    // Fetch event with all data
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        eventId: true, organizerName: true, phoneNumber: true,
        location: true, homeAddress: true, functionDate: true,
        functionTime: true, guestCount: true, notes: true,
        eventItems: {
          select: {
            mealLabel: true, mealDate: true, mealGuests: true, mealPerPlate: true,
            item: { select: { name: true, category: { select: { name: true, sortOrder: true } } } }
          }
        },
        eventIngredients: {
          where: { status: { not: "removed" }, quantity: { gt: 0 } },
          select: {
            quantity: true, notes: true,
            ingredient: {
              select: { name: true, unit: true, category: { select: { name: true, sortOrder: true } } }
            }
          }
        }
      }
    })

    if (!event) {
      return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 })
    }

    // =============================================
    // Build meal groups
    // =============================================
    const mealGroups: Record<string, {
      label: string; date: string | null; guests: number; perPlate: number;
      items: { name: string; categorySortOrder: number; categoryName: string }[]
    }> = {}

    event.eventItems.forEach(ei => {
      const label = ei.mealLabel || "default"
      const dateStr = ei.mealDate ? ei.mealDate.toISOString().split("T")[0] : ""
      const key = `${label}::${dateStr}`
      if (!mealGroups[key]) {
        mealGroups[key] = {
          label, date: ei.mealDate ? ei.mealDate.toISOString() : null,
          guests: ei.mealGuests || 0, perPlate: ei.mealPerPlate || 0, items: []
        }
      }
      mealGroups[key].items.push({
        name: ei.item.name,
        categorySortOrder: ei.item.category?.sortOrder || 0,
        categoryName: ei.item.category?.name || ""
      })
    })

    Object.values(mealGroups).forEach(g => {
  g.items.sort((a, b) => a.categorySortOrder - b.categorySortOrder || a.name.localeCompare(b.name))
})

    // Sort items within each group by category sortOrder then name
    Object.values(mealGroups).forEach(g => {
      g.items.sort((a, b) => a.categorySortOrder - b.categorySortOrder || a.name.localeCompare(b.name))
    })

    // =============================================
    // Build ingredient groups (sorted by category sortOrder)
    // =============================================
    const ingGroups: Record<string, {
      categoryName: string; sortOrder: number;
      ingredients: { name: string; quantity: number; unit: string; notes: string | null }[]
    }> = {}

    event.eventIngredients.forEach(ei => {
      const catName = ei.ingredient?.category?.name || "Other"
      const sortOrder = ei.ingredient?.category?.sortOrder || 0
      if (!ingGroups[catName]) {
        ingGroups[catName] = { categoryName: catName, sortOrder, ingredients: [] }
      }
      ingGroups[catName].ingredients.push({
        name: ei.ingredient?.name || "Unknown",
        quantity: ei.quantity,
        unit: ei.ingredient?.unit || "",
        notes: ei.notes || null
      })
    })

    const sortedIngGroups = Object.values(ingGroups).sort((a, b) => a.sortOrder - b.sortOrder)
    sortedIngGroups.forEach(g => g.ingredients.sort((a, b) => a.name.localeCompare(b.name)))

    // =============================================
    // Build document sections
    // =============================================
    const children: Paragraph[] = []
    const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
    const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" }

    // Header
    children.push(new Paragraph({
      children: [new TextRun({ text: event.organizerName, bold: true, size: 32 })],
      alignment: AlignmentType.LEFT,
      spacing: { after: 100 }
    }))

    // Event details line
    const dateFmt = event.functionDate ? new Date(event.functionDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""
    const details = [
  dateFmt,
  event.location ? `Venue: ${event.location}` : "",
  event.homeAddress ? `Home: ${event.homeAddress}` : "",
  event.phoneNumber
].filter(Boolean).join("  |  ")

    children.push(new Paragraph({
      children: [new TextRun({ text: details, size: 18, color: "666666" })],
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "333333" } }
    }))

    // =============================================
    // Menu items per meal group
    // =============================================
    const mealOrder: Record<string, number> = { breakfast: 1, brunch: 2, lunch: 3, "high-tea": 4, snacks: 5, dinner: 6 }
    const sortedMealGroups = Object.values(mealGroups).sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0
      const dateB = b.date ? new Date(b.date).getTime() : 0
      if (dateA !== dateB) return dateA - dateB
      return (mealOrder[a.label] || 99) - (mealOrder[b.label] || 99)
    })

    for (const group of sortedMealGroups) {
      const mealDateFmt = group.date ? new Date(group.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""
      const mealTitle = `${group.label === "default" ? event.functionTime : group.label} (${mealDateFmt}) — ${group.guests} Guests`

      children.push(new Paragraph({
        children: [new TextRun({ text: mealTitle, bold: true, size: 22 })],
        spacing: { before: 200, after: 100 }
      }))

      // Menu items in a 4-column table
      const cols = 4
      const rows: TableRow[] = []
      const colWidth = Math.floor(9000 / cols) // ~9000 DXA = page width minus margins

      for (let i = 0; i < group.items.length; i += cols) {
        const cells: TableCell[] = []
        for (let j = 0; j < cols; j++) {
          const item = group.items[i + j]
          cells.push(new TableCell({
            children: [new Paragraph({
              children: item
                ? [new TextRun({ text: item.name, bold: true, size: 18 })]
                : [new TextRun({ text: "", size: 18 })]
            })],
            width: { size: colWidth, type: WidthType.DXA },
            borders: {
              top: thinBorder, bottom: thinBorder,
              left: thinBorder, right: thinBorder
            }
          }))
        }
        rows.push(new TableRow({ children: cells }))
      }

      if (rows.length > 0) {
        children.push(new Paragraph({ children: [] })) // spacer
        const table = new Table({
          rows,
          width: { size: 9000, type: WidthType.DXA },
          columnWidths: Array(cols).fill(colWidth),
          layout: TableLayoutType.FIXED
        })
        // Tables can't be pushed to children array directly — use a section approach
        // Actually in docx-js, Document sections accept both Paragraphs and Tables
        // We'll collect tables separately and merge in the document
      }
    }

    // =============================================
    // Build the actual document with tables
    // =============================================
    // Since docx-js sections accept mixed Paragraph/Table, rebuild with proper interleaving

    const docChildren: (Paragraph | Table)[] = []

    // Header paragraphs
    docChildren.push(new Paragraph({
      children: [new TextRun({ text: event.organizerName, bold: true, size: 32 })],
      alignment: AlignmentType.LEFT,
      spacing: { after: 100 }
    }))

    docChildren.push(new Paragraph({
      children: [new TextRun({ text: details, size: 18, color: "666666" })],
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "333333" } }
    }))

    // Menu items per meal
     for (const group of sortedMealGroups) {
      const mealDateFmt = group.date ? new Date(group.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""
      const mealTitle = `${group.label === "default" ? event.functionTime : group.label} (${mealDateFmt}) — ${group.guests} Guests`

      docChildren.push(new Paragraph({
        children: [new TextRun({ text: mealTitle, bold: true, size: 22 })],
        spacing: { before: 200, after: 100 }
      }))

      // 4-column table of items
      const cols = 4
      const colWidth = Math.floor(9000 / cols)
      const rows: TableRow[] = []

      for (let i = 0; i < group.items.length; i += cols) {
        const cells: TableCell[] = []
        for (let j = 0; j < cols; j++) {
          const item = group.items[i + j]
          cells.push(new TableCell({
            children: [new Paragraph({
              children: item
                ? [new TextRun({ text: item.name, bold: true, size: 18 })]
                : [new TextRun({ text: "", size: 18 })]
            })],
            width: { size: colWidth, type: WidthType.DXA },
            borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }
          }))
        }
        rows.push(new TableRow({ children: cells }))
      }

      if (rows.length > 0) {
        docChildren.push(new Table({
          rows,
          width: { size: 9000, type: WidthType.DXA },
          columnWidths: Array(cols).fill(colWidth),
          layout: TableLayoutType.FIXED
        }))
      }
    }

    // =============================================
    // Ingredients (only in full mode) — single grid matching PDF layout
    // =============================================
    if (mode === "full") {
      // Flatten all ingredients sorted by category sortOrder, then by name
       const allIngredients = sortedIngGroups.flatMap(g =>
        g.ingredients.map(ing => ({
          name: ing.name, quantity: ing.quantity, unit: ing.unit, notes: ing.notes
        }))
      )
 
      if (allIngredients.length > 0) {
        docChildren.push(new Paragraph({
          children: [new TextRun({ text: "Ingredients", bold: true, size: 24 })],
          spacing: { before: 300, after: 100 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" } }
        }))
 
        // 4 ingredient blocks across; each block = 2 columns (name | qty)
        const BLOCKS = 4
        const nameColWidth = 1700   // wide column for name + note
        const qtyColWidth = 550     // narrow column for quantity, right-aligned
        const totalRows = Math.ceil(allIngredients.length / BLOCKS)
        const rows: TableRow[] = []
 
        // Column widths array: [name, qty, name, qty, name, qty, name, qty]
        const columnWidths: number[] = []
        for (let b = 0; b < BLOCKS; b++) {
          columnWidths.push(nameColWidth, qtyColWidth)
        }
 
        for (let row = 0; row < totalRows; row++) {
          const cells: TableCell[] = []
          for (let b = 0; b < BLOCKS; b++) {
            const idx = b * totalRows + row
            const ing = allIngredients[idx]
 
            if (ing) {
              const noteText = ing.notes ? ` (${ing.notes})` : ""
              // Name + note cell (left)
              cells.push(new TableCell({
                children: [new Paragraph({
                  children: [
                    new TextRun({ text: ing.name, size: 16 }),
                    ...(ing.notes ? [new TextRun({ text: noteText, size: 13, color: "B45309" })] : [])
                  ]
                })],
                width: { size: nameColWidth, type: WidthType.DXA },
                borders: {
                  top: thinBorder, bottom: thinBorder,
                  left: thinBorder, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
                }
              }))
              // Quantity cell (right-aligned)
              cells.push(new TableCell({
                children: [new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: `${ing.quantity} ${ing.unit}`, bold: true, size: 16 })]
                })],
                width: { size: qtyColWidth, type: WidthType.DXA },
                borders: {
                  top: thinBorder, bottom: thinBorder,
                  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: thinBorder
                }
              }))
            } else {
              // Two empty cells to keep grid aligned
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
      }}


    // Menu-only footer note
    if (mode === "menuOnly") {
      docChildren.push(new Paragraph({
        children: [new TextRun({
          text: "* Price will increase as the number of guests increases / मेहमानों की संख्या बढ़ने पर कीमत बढ़ेगी",
          bold: true, size: 20
        })],
        spacing: { before: 300 },
        border: { top: { style: BorderStyle.SINGLE, size: 2, color: "000000" } },
        alignment: AlignmentType.CENTER
      }))
    }

    // Notes
    if (event.notes) {
      docChildren.push(new Paragraph({
        children: [
          new TextRun({ text: "Notes: ", bold: true, size: 18 }),
          new TextRun({ text: event.notes, size: 18 })
        ],
        spacing: { before: 200 }
      }))
    }

    // =============================================
    // Generate document
    // =============================================
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 } // 0.5 inch margins
          }
        },
        children: docChildren
      }]
    })

    const buffer = await Packer.toBuffer(doc)
    const uint8 = new Uint8Array(buffer)

    // CHANGED: filename = organizerName_eventDate_home
    const safe = (s: string) => (s || "").replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "")
    const dateForName = event.functionDate ? new Date(event.functionDate).toISOString().split("T")[0] : "nodate"
    const filename = `${safe(event.organizerName)}_${dateForName}_${safe(event.homeAddress || "nohome")}.docx`

    return new NextResponse(uint8, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    })
  } catch (error) {
    console.error("Error exporting event docx:", error)
    return NextResponse.json({ success: false, error: "Failed to export" }, { status: 500 })
  }
}
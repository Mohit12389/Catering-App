import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { getEffectiveUserId } from "@/lib/getEffectiveUserId"  // CHANGED: scope export to the caller's own data
import { groupIntoMeals, groupIngredientsByCategory, compareByCategoryThenName } from "@/lib/mealGroups"  // CHANGED: shared event projections
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

    // CHANGED: resolve the caller so the event fetch can be ownership-scoped.
    // Without this, any signed-in user could export ANY event by guessing its id.
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true, ownerId: true }
    })
    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }
    const effectiveUserId = getEffectiveUserId(dbUser)

    // Fetch event with all data
    // CHANGED: findUnique -> findFirst so the query can filter on userId too
    const event = await prisma.event.findFirst({
      where: { id: eventId, userId: effectiveUserId },
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
    // CHANGED: shared groupIntoMeals (was an inline copy of the composite-key
    // grouping). guests/perPlate are coerced to 0 here because they are printed
    // directly into the meal title ("200 Guests") — a null would render "null".
    const sortedMealGroups = groupIntoMeals(
      event.eventItems,
      ei => ({
        name: ei.item.name,
        categorySortOrder: ei.item.category?.sortOrder || 0,
        categoryName: ei.item.category?.name || ""
      }),
      { sortItems: compareByCategoryThenName }
    ).map(g => ({ ...g, guests: g.guests || 0, perPlate: g.perPlate || 0 }))

    // =============================================
    // Build ingredient groups (sorted by category sortOrder)
    // =============================================
    // CHANGED: shared groupIngredientsByCategory. Grouped by category NAME (the
    // query doesn't select category.id) and WITHOUT a name tiebreak, both of
    // which match the previous inline behaviour exactly.
    const sortedIngGroups = groupIngredientsByCategory(
      event.eventIngredients,
      ei => ({
        id: ei.ingredient?.category?.name || "Other",
        name: ei.ingredient?.category?.name || "Other",
        sortOrder: ei.ingredient?.category?.sortOrder || 0
      }),
      ei => ({
        name: ei.ingredient?.name || "Unknown",
        quantity: ei.quantity,
        unit: ei.ingredient?.unit || "",
        notes: ei.notes || null
      }),
      { sortIngredients: (a, b) => a.name.localeCompare(b.name) }
    )

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
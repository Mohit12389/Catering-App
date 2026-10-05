import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/withAuth" // CHANGED: replaces the repeated auth/dbUser/try-catch preamble
import { groupIntoMeals, groupIngredientsByCategory, compareByCategoryThenName } from "@/lib/mealGroups"  // CHANGED: shared event projections
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, WidthType, AlignmentType, BorderStyle, HeadingLevel,
  ShadingType, TableLayoutType, TabStopType, VerticalAlign  // CHANGED: + VerticalAlign
} from "docx"

// =============================================
// EXPORT EVENT AS .DOCX
// =============================================
// GET /api/export/event-docx?eventId=xxx&mode=full|menuOnly
// CHANGED: GET /api/export/event-docx?eventIds=a,b&mode=menuOnly — ONE file with the
// menus of several events (same organizer, different venues). Each event keeps its own
// section with its venue line; nothing is merged across venues. Menu only — ingredients
// are per venue (the procurement boundary), so a combined ingredient sheet isn't offered.

// CHANGED: withAuth resolves the session, loads the user and hands over
// effectiveUserId (the owner's id for staff) already resolved.
export const GET = withAuth(async (req: NextRequest, { effectiveUserId }) => {
    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get("eventId")
    const mode = searchParams.get("mode") || "full" // "full" or "menuOnly"
    // CHANGED: several events → one menu file. A single eventId is just a list of one.
    const eventIds = searchParams.get("eventIds")?.split(",").filter(Boolean) || (eventId ? [eventId] : [])

    if (eventIds.length === 0) {
      return NextResponse.json({ success: false, error: "eventId required" }, { status: 400 })
    }
    const combined = eventIds.length > 1
    if (combined && mode !== "menuOnly") {
      return NextResponse.json({ success: false, error: "Combined download is menu only" }, { status: 400 })
    }

    // effectiveUserId comes from withAuth. It still scopes the event fetch below —
    // without that filter any signed-in user could export ANY event by guessing its id.
    // Fetch event with all data
    // CHANGED: findUnique -> findFirst so the query can filter on userId too
    // CHANGED: findMany over the requested ids (still scoped to userId), earliest first
    const events = await prisma.event.findMany({
      where: { id: { in: eventIds }, userId: effectiveUserId },
      orderBy: { functionDate: "asc" },
      select: {
        eventId: true, organizerName: true, phoneNumber: true,
        location: true, homeAddress: true, functionDate: true,
        functionTime: true, guestCount: true, notes: true,
        eventItems: {
          select: {
            mealLabel: true, mealDate: true, mealGuests: true, mealPerPlate: true, mealNotes: true,  // CHANGED: + mealNotes
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

    // CHANGED: every requested event must exist and belong to this business
    if (events.length !== eventIds.length) {
      return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 })
    }
    // The first (earliest) event supplies the organizer header and the filename; in a
    // single-event download it is simply THE event, so everything below reads as before.
    const event = events[0]

    // =============================================
    // Build meal groups
    // =============================================
    // CHANGED: shared groupIntoMeals (was an inline copy of the composite-key
    // grouping). guests/perPlate are coerced to 0 here because they are printed
    // directly into the meal title ("200 Guests") — a null would render "null".
    // CHANGED: a function of the event, so each event in a combined file gets its own meals
    const mealGroupsOf = (ev: typeof event) => groupIntoMeals(
      ev.eventItems,
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
    // CHANGED: removed an abandoned first pass that built the whole document into a
    // `children: Paragraph[]` array, constructed the menu-item table as a local
    // `const table` and then never pushed it anywhere. Nothing read `children`
    // after it, because the document is assembled from `docChildren` below. It is
    // gone; only the values the real pass still uses are kept.
    const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }

    // CHANGED: sizes, borders and margins now mirror the PDF print (the print-only markup
    // in event-history/[eventId]/page.tsx). Printed at 100%, 1 CSS px = 0.75pt, and docx
    // font sizes are half-points, so size = px × 1.5. Font is Arial — the PDF uses Inter,
    // falling back to the system sans-serif, and Arial is the sans-serif every PC has.
    const PAGE_MARGIN = 330                          // twips ≈ 0.23in — where the PDF's content starts (6px padding + 16px margin)
    const CONTENT_W = 11906 - 2 * PAGE_MARGIN        // A4 width minus both margins: tables fill the page like the PDF grids
    const SZ = { title: 30, details: 18, heading: 21, menuItem: 20, ing: 18, ingNote: 16, notes: 15, footer: 20, venue: 24 }
    const menuBorder = { style: BorderStyle.SINGLE, size: 6, color: "E5E7EB" }   // PDF menu grid: 1px #e5e7eb
    const ingBorder = { style: BorderStyle.SINGLE, size: 6, color: "000000" }    // PDF ingredient grid: 1px black
    const headingRule = { style: BorderStyle.SINGLE, size: 6, color: "D1D5DB" }  // PDF section headings: 1px #d1d5db underline
    const cellMargins = { top: 15, bottom: 15, left: 60, right: 60 }             // PDF cell padding: 1px 4px
    const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s  // PDF: text-transform capitalize

    // Event details line
    // CHANGED: per event (same text as before), so each event's section gets its own line
    const detailsOf = (ev: typeof event) => {
    const dateFmt = ev.functionDate ? new Date(ev.functionDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""
    return [
  dateFmt,
  ev.location ? `Venue: ${ev.location}` : "",
  ev.homeAddress ? `Home: ${ev.homeAddress}` : "",
  ev.phoneNumber
].filter(Boolean).join("  |  ")
    }

    // =============================================
    // Build the actual document with tables
    // =============================================
    // Since docx-js sections accept mixed Paragraph/Table, rebuild with proper interleaving

    const docChildren: (Paragraph | Table)[] = []

    // Header paragraphs
    docChildren.push(new Paragraph({
      children: [new TextRun({ text: event.organizerName, bold: true, size: SZ.title })],  // CHANGED: PDF 20px
      alignment: AlignmentType.LEFT,
      spacing: { after: 30 }
    }))

    // CHANGED: one section per event — its venue heading (combined file only), its
    // details line, then its meals. A single-event file has exactly one section, as before.
    for (const ev of events) {
    if (combined) {
      docChildren.push(new Paragraph({
        children: [new TextRun({ text: `Venue / कार्यक्रम स्थल: ${ev.location || "—"}`, bold: true, size: SZ.venue })],
        spacing: { before: 240, after: 30 }
      }))
    }

    docChildren.push(new Paragraph({
      // CHANGED: PDF details line — 12px black, 2px black rule underneath
      children: [new TextRun({ text: detailsOf(ev), size: SZ.details })],
      spacing: { after: 45 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "000000" } }
    }))

    // Menu items per meal
     for (const group of mealGroupsOf(ev)) {
      const mealDateFmt = group.date ? new Date(group.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""
      const mealTitle = `${capitalize((group.label === "default" ? ev.functionTime : group.label) || "")} (${mealDateFmt}) — ${group.guests} Guests`

      // CHANGED: PDF meal heading — 14px bold, thin grey underline, 6px gap above
      docChildren.push(new Paragraph({
        children: [
          new TextRun({ text: mealTitle, bold: true, size: SZ.heading }),
          // CHANGED: per-meal note on the heading line — amber, not bold, like the PDF
          ...(group.notes ? [new TextRun({ text: `  · Note: ${group.notes}`, size: SZ.details, color: "B45309" })] : [])
        ],
        spacing: { before: 90, after: 30 },
        border: { bottom: headingRule }
      }))

      // 4-column table of items
      // CHANGED: fill COLUMN-first, not row-first. The print grid uses
      // gridAutoFlow:"column" and the Excel export uses c * totalRows + r, so
      // Word was the only surface reading left-to-right. This route's own
      // ingredient grid below was already column-first.
      const cols = 4
      const colWidth = Math.floor(CONTENT_W / cols)  // CHANGED: full page width (was 9000)
      const rows: TableRow[] = []
      const menuRows = Math.ceil(group.items.length / cols)

      for (let row = 0; row < menuRows; row++) {
        const cells: TableCell[] = []
        for (let c = 0; c < cols; c++) {
          const item = group.items[c * menuRows + row]
          cells.push(new TableCell({
            children: [new Paragraph({
              children: item
                ? [new TextRun({ text: item.name, bold: true, size: SZ.menuItem })]  // CHANGED: PDF 13px bold (was 9pt)
                : [new TextRun({ text: "", size: SZ.menuItem })]
            })],
            width: { size: colWidth, type: WidthType.DXA },
            margins: cellMargins,
            borders: { top: menuBorder, bottom: menuBorder, left: menuBorder, right: menuBorder }
          }))
        }
        rows.push(new TableRow({ children: cells }))
      }

      if (rows.length > 0) {
        docChildren.push(new Table({
          rows,
          width: { size: colWidth * cols, type: WidthType.DXA },
          columnWidths: Array(cols).fill(colWidth),
          layout: TableLayoutType.FIXED
        }))
      }
    }

    // CHANGED: in a combined file each event's notes follow its own meals (a single-event
    // file keeps its notes at the very end, below).
    if (combined && ev.notes) {
      docChildren.push(new Paragraph({
        children: [
          new TextRun({ text: "Notes: ", bold: true, size: SZ.notes }),  // CHANGED: PDF 10px
          new TextRun({ text: ev.notes, size: SZ.notes })
        ],
        spacing: { before: 200 }
      }))
    }
    }  // CHANGED: end of per-event section

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
          // CHANGED: PDF "Ingredients" heading — 14px bold, thin grey underline
          children: [new TextRun({ text: "Ingredients", bold: true, size: SZ.heading })],
          spacing: { before: 45, after: 30 },
          border: { bottom: headingRule }
        }))
 
        // 4 ingredient blocks across; each block = 2 columns (name | qty)
        const BLOCKS = 4
        // CHANGED: the four blocks now fill the page width (was 9000 twips in total), so
        // names have room; a name that is still too long wraps inside its cell instead
        // of being cut off.
        const qtyColWidth = 900                                     // quantity, right-aligned
        const nameColWidth = Math.floor(CONTENT_W / BLOCKS) - qtyColWidth  // name + note
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
                    new TextRun({ text: ing.name, size: SZ.ing }),  // CHANGED: PDF 12px (was 8pt)
                    ...(ing.notes ? [new TextRun({ text: noteText, size: SZ.ingNote, color: "B45309" })] : [])  // CHANGED: was 6.5pt
                  ]
                })],
                width: { size: nameColWidth, type: WidthType.DXA },
                margins: cellMargins,
                verticalAlign: VerticalAlign.CENTER,
                // CHANGED: black 1px outline like the PDF; no line between name and quantity
                borders: { top: ingBorder, bottom: ingBorder, left: ingBorder, right: noBorder }
              }))
              // Quantity cell (right-aligned)
              cells.push(new TableCell({
                children: [new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: `${ing.quantity} ${ing.unit}`, bold: true, size: SZ.ing })]
                })],
                width: { size: qtyColWidth, type: WidthType.DXA },
                margins: cellMargins,
                verticalAlign: VerticalAlign.CENTER,
                borders: { top: ingBorder, bottom: ingBorder, left: noBorder, right: ingBorder }
              }))
            } else {
              // Two empty cells to keep grid aligned
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
          bold: true, size: SZ.footer  // CHANGED: PDF 13px bold, 2px black rule above
        })],
        spacing: { before: 150 },
        border: { top: { style: BorderStyle.SINGLE, size: 12, color: "000000" } },
        alignment: AlignmentType.CENTER
      }))
    }

    // Notes
    if (!combined && event.notes) {  // CHANGED: combined files print notes per event above
      docChildren.push(new Paragraph({
        children: [
          new TextRun({ text: "Notes: ", bold: true, size: SZ.notes }),  // CHANGED: PDF 10px
          new TextRun({ text: event.notes, size: SZ.notes })
        ],
        spacing: { before: 200 }
      }))
    }

    // =============================================
    // Generate document
    // =============================================
    const doc = new Document({
      // CHANGED: Arial everywhere by default (matches the PDF's sans-serif)
      styles: { default: { document: { run: { font: "Arial" } } } },
      sections: [{
        properties: {
          page: {
            // CHANGED: A4 with the PDF's narrow margins (was 0.5in on every side)
            size: { width: 11906, height: 16838 },
            margin: { top: PAGE_MARGIN, right: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN }
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
    // CHANGED: combined file → organizerName_firstEventDate_combined_menu
    const filename = combined
      ? `${safe(event.organizerName)}_${dateForName}_combined_menu.docx`
      : `${safe(event.organizerName)}_${dateForName}_${safe(event.homeAddress || "nohome")}.docx`

    return new NextResponse(uint8, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    })
})

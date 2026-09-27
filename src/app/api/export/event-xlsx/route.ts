import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/withAuth" // CHANGED: replaces the repeated auth/dbUser/try-catch preamble
import { groupIntoMeals, groupIngredientsByCategory, compareByCategoryThenName } from "@/lib/mealGroups"  // CHANGED: shared event projections
import ExcelJS from "exceljs"

// =============================================
// EXPORT EVENT AS .XLSX — matches PDF/Word layout
// =============================================
// GET /api/export/event-xlsx?eventId=xxx&mode=full|menuOnly
// CHANGED: GET /api/export/event-xlsx?eventIds=a,b&mode=menuOnly — ONE sheet with the
// menus of several events (same organizer, different venues), each in its own section
// with its venue line. Menu only — ingredients stay per venue.
// Layout: event info header, menu items in grid (by rank),
// ingredients in grid with name+note left, quantity right per cell.

// CHANGED: withAuth resolves the session, loads the user and hands over
// effectiveUserId (the owner's id for staff) already resolved.
export const GET = withAuth(async (req: NextRequest, { effectiveUserId }) => {
    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get("eventId")
    const mode = searchParams.get("mode") || "full"
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

    // CHANGED: every requested event must exist and belong to this business
    if (events.length !== eventIds.length) {
      return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 })
    }
    // The first (earliest) event supplies the organizer header and the filename; in a
    // single-event download it is simply THE event, so everything below reads as before.
    const event = events[0]

    // =============================================
    // Build meal groups (sorted by date, meal type, category rank)
    // =============================================
    // CHANGED: shared groupIntoMeals (was an inline copy of the composite-key
    // grouping). guests is coerced to 0 here because it is printed directly into
    // the meal title ("200 Guests") — a null would render "null".
    // CHANGED: a function of the event, so each event in a combined file gets its own meals
    const mealGroupsOf = (ev: typeof event) => groupIntoMeals(
      ev.eventItems,
      ei => ({
        name: ei.item.name,
        categorySortOrder: ei.item.category?.sortOrder || 0
      }),
      { sortItems: compareByCategoryThenName }
    ).map(g => ({ ...g, guests: g.guests || 0, perPlate: g.perPlate || 0 }))

    // =============================================
    // Build ingredient list (flattened, sorted by category rank then name)
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
    const allIngredients = sortedIngGroups.flatMap(g => g.ingredients)

    // =============================================
    // Build single worksheet matching PDF/Word layout
    // =============================================
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet("Event")

    const GREEN = "FF4A7C59"
    const AMBER = "FFB45309"
    const GREY = "FF666666"
    const arial = (opts: any = {}) => ({ name: "Arial", ...opts })

    let rowNum = 1

    // ---- Event header ----
    const titleCell = ws.getCell(`A${rowNum}`)
    titleCell.value = event.organizerName
    titleCell.font = arial({ bold: true, size: 16 })
    rowNum++

    // ---- Menu items per meal (grid, 4 columns) ----
    const MENU_COLS = 4
    // CHANGED: one section per event — venue heading (combined file only), details
    // line, meals. A single-event file has exactly one section, as before.
    for (const ev of events) {
    if (combined) {
      const venueCell = ws.getCell(`A${rowNum}`)
      venueCell.value = `Venue / कार्यक्रम स्थल: ${ev.location || "—"}`
      venueCell.font = arial({ bold: true, size: 13 })
      rowNum++
    }

    const dateFmt = ev.functionDate
      ? new Date(ev.functionDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : ""
    const detailParts = [
  dateFmt,
  ev.location ? `Venue: ${ev.location}` : "",
  ev.homeAddress ? `Home: ${ev.homeAddress}` : "",
  ev.phoneNumber
].filter(Boolean)
    const detailCell = ws.getCell(`A${rowNum}`)
    detailCell.value = detailParts.join("   |   ")
    detailCell.font = arial({ size: 10, color: { argb: GREY } })
    rowNum += 2

    mealGroupsOf(ev).forEach(group => {
      const mealDateFmt = group.date
        ? new Date(group.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
        : ""
      const mealName = group.label === "default" ? ev.functionTime : group.label

      // Meal title row
      const mealTitleCell = ws.getCell(`A${rowNum}`)
      mealTitleCell.value = `${mealName} (${mealDateFmt}) - ${group.guests} Guests`
      mealTitleCell.font = arial({ bold: true, size: 12 })
      rowNum++

      // Items in a grid, column-first fill
      //
      // CHANGED: a long item name used to be cut off. Two causes, both fixed here.
      //
      // 1. The menu grid wrote into columns 1..4, but the column widths further
      //    down are 22,12,22,12,... — they size the INGREDIENT grid's name/qty
      //    PAIRS. So menu columns 2 and 4 were only 12 wide. Each menu item now
      //    spans its own 2-column block (widths 22+12), so all four menu columns
      //    are equally wide and line up with the ingredient grid above/below.
      // 2. No alignment was set, so wrapText was off. Excel then spills text into
      //    an EMPTY neighbour but clips it against a filled one — which is why a
      //    name looked complete only when the next cell happened to be empty.
      //    Long names now wrap inside their own cell, as ingredient names already do.
      const items = group.items
      const totalRows = Math.ceil(items.length / MENU_COLS)
      for (let r = 0; r < totalRows; r++) {
        for (let c = 0; c < MENU_COLS; c++) {
          const idx = c * totalRows + r
          if (items[idx]) {
            const nameCol = c * 2 + 1
            const cell = ws.getCell(rowNum + r, nameCol)
            cell.value = items[idx].name
            cell.font = arial({ bold: true, size: 11 })
            cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true }
            cell.border = {
              top: { style: "thin", color: { argb: "FFCCCCCC" } },
              bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
              left: { style: "thin", color: { argb: "FFCCCCCC" } },
              right: { style: "thin", color: { argb: "FFCCCCCC" } }
            }
            // Merge the block's two columns so the name owns the full width.
            ws.mergeCells(rowNum + r, nameCol, rowNum + r, nameCol + 1)
          }
        }
      }
      rowNum += totalRows + 1 // gap after meal
    })

    // CHANGED: in a combined file each event's notes follow its own meals (a single-event
    // file keeps its notes at the very end, below).
    if (combined && ev.notes) {
      const nCell = ws.getCell(`A${rowNum}`)
      nCell.value = `Notes: ${ev.notes}`
      nCell.font = arial({ size: 10 })
      rowNum += 2
    }
    rowNum += combined ? 1 : 0  // CHANGED: extra gap between event sections
    }  // CHANGED: end of per-event section

    // ---- Ingredients grid (only full mode) ----
    // Layout: pairs of columns (name | qty), 4 ingredient blocks across.
    // Name+note on left column, quantity right-aligned in adjacent column.
    if (mode === "full" && allIngredients.length > 0) {
      rowNum++
      const ingHeader = ws.getCell(`A${rowNum}`)
      ingHeader.value = "Ingredients"
      ingHeader.font = arial({ bold: true, size: 14 })
      rowNum++

      const ING_BLOCKS = 4 // number of ingredient blocks across
      const totalRows = Math.ceil(allIngredients.length / ING_BLOCKS)

      for (let r = 0; r < totalRows; r++) {
        for (let b = 0; b < ING_BLOCKS; b++) {
          const idx = b * totalRows + r
          const ing = allIngredients[idx]
          if (ing) {
            // Each block spans 2 columns: name(+note) and quantity
            const nameCol = b * 2 + 1
            const qtyCol = b * 2 + 2

            // Name + note cell (left aligned)
            const nameCell = ws.getCell(rowNum + r, nameCol)
            const noteText = ing.notes ? ` (${ing.notes})` : ""
            nameCell.value = {
              richText: [
                { text: ing.name, font: arial({ size: 10 }) },
                ...(ing.notes ? [{ text: noteText, font: arial({ size: 9, color: { argb: AMBER } }) }] : [])
              ]
            }
            nameCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true }
            nameCell.border = {
              top: { style: "thin", color: { argb: "FFCCCCCC" } },
              bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
              left: { style: "thin", color: { argb: "FFCCCCCC" } }
            }

            // Quantity cell (right aligned)
            const qtyCell = ws.getCell(rowNum + r, qtyCol)
            qtyCell.value = `${ing.quantity} ${ing.unit}`
            qtyCell.font = arial({ bold: true, size: 10 })
            qtyCell.alignment = { horizontal: "right", vertical: "middle" }
            qtyCell.border = {
              top: { style: "thin", color: { argb: "FFCCCCCC" } },
              bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
              right: { style: "thin", color: { argb: "FFCCCCCC" } }
            }
          }
        }
      }
      rowNum += totalRows
    }

    // ---- Menu only footer note ----
    if (mode === "menuOnly") {
      rowNum++
      const noteCell = ws.getCell(`A${rowNum}`)
      noteCell.value = "* Price will increase as the number of guests increases / मेहमानों की संख्या बढ़ने पर कीमत बढ़ेगी"
      noteCell.font = arial({ bold: true, size: 11 })
    }

    // ---- Notes ----
    if (!combined && event.notes) {  // CHANGED: combined files print notes per event above
      rowNum += 2
      const nCell = ws.getCell(`A${rowNum}`)
      nCell.value = `Notes: ${event.notes}`
      nCell.font = arial({ size: 10 })
    }

    // ---- Column widths ----
    // Menu grid uses cols 1-4; ingredient grid uses 8 cols (4 name + 4 qty pairs)
    // Set reasonable widths so both look balanced
    ws.getColumn(1).width = 22
    ws.getColumn(2).width = 12
    ws.getColumn(3).width = 22
    ws.getColumn(4).width = 12
    ws.getColumn(5).width = 22
    ws.getColumn(6).width = 12
    ws.getColumn(7).width = 22
    ws.getColumn(8).width = 12

    // =============================================
    // Generate file
    // =============================================
    const buffer = await wb.xlsx.writeBuffer()
    const uint8 = new Uint8Array(buffer)
    
    // CHANGED: filename = organizerName_eventDate_home
    const safe = (s: string) => (s || "").replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "")
    const dateForName = event.functionDate ? new Date(event.functionDate).toISOString().split("T")[0] : "nodate"
    // CHANGED: combined file → organizerName_firstEventDate_combined_menu
    const filename = combined
      ? `${safe(event.organizerName)}_${dateForName}_combined_menu.xlsx`
      : `${safe(event.organizerName)}_${dateForName}_${safe(event.homeAddress || "nohome")}.xlsx`

    return new NextResponse(uint8, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    })
})

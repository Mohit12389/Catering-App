import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import ExcelJS from "exceljs"

// =============================================
// EXPORT EVENT AS .XLSX — matches PDF/Word layout
// =============================================
// GET /api/export/event-xlsx?eventId=xxx&mode=full|menuOnly
// Layout: event info header, menu items in grid (by rank),
// ingredients in grid with name+note left, quantity right per cell.

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get("eventId")
    const mode = searchParams.get("mode") || "full"

    if (!eventId) {
      return NextResponse.json({ success: false, error: "eventId required" }, { status: 400 })
    }

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
    // Build meal groups (sorted by date, meal type, category rank)
    // =============================================
    const mealGroups: Record<string, {
      label: string; date: string | null; guests: number; perPlate: number;
      items: { name: string; categorySortOrder: number }[]
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
        categorySortOrder: ei.item.category?.sortOrder || 0
      })
    })

    Object.values(mealGroups).forEach(g => {
      g.items.sort((a, b) => a.categorySortOrder - b.categorySortOrder || a.name.localeCompare(b.name))
    })

    const mealOrder: Record<string, number> = { breakfast: 1, brunch: 2, lunch: 3, "high-tea": 4, snacks: 5, dinner: 6 }
    const sortedMealGroups = Object.values(mealGroups).sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0
      const dateB = b.date ? new Date(b.date).getTime() : 0
      if (dateA !== dateB) return dateA - dateB
      return (mealOrder[a.label] || 99) - (mealOrder[b.label] || 99)
    })

    // =============================================
    // Build ingredient list (flattened, sorted by category rank then name)
    // =============================================
    const ingGroups: Record<string, {
      sortOrder: number;
      ingredients: { name: string; quantity: number; unit: string; notes: string | null }[]
    }> = {}

    event.eventIngredients.forEach(ei => {
      const catName = ei.ingredient?.category?.name || "Other"
      const sortOrder = ei.ingredient?.category?.sortOrder || 0
      if (!ingGroups[catName]) ingGroups[catName] = { sortOrder, ingredients: [] }
      ingGroups[catName].ingredients.push({
        name: ei.ingredient?.name || "Unknown",
        quantity: ei.quantity,
        unit: ei.ingredient?.unit || "",
        notes: ei.notes || null
      })
    })

    const sortedIngGroups = Object.values(ingGroups).sort((a, b) => a.sortOrder - b.sortOrder)
    sortedIngGroups.forEach(g => g.ingredients.sort((a, b) => a.name.localeCompare(b.name)))
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

    const dateFmt = event.functionDate
      ? new Date(event.functionDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : ""
    const detailParts = [
  dateFmt,
  event.location ? `Venue: ${event.location}` : "",
  event.homeAddress ? `Home: ${event.homeAddress}` : "",
  event.phoneNumber
].filter(Boolean)
    const detailCell = ws.getCell(`A${rowNum}`)
    detailCell.value = detailParts.join("   |   ")
    detailCell.font = arial({ size: 10, color: { argb: GREY } })
    rowNum += 2

    // ---- Menu items per meal (grid, 4 columns) ----
    const MENU_COLS = 4
    sortedMealGroups.forEach(group => {
      const mealDateFmt = group.date
        ? new Date(group.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
        : ""
      const mealName = group.label === "default" ? event.functionTime : group.label

      // Meal title row
      const mealTitleCell = ws.getCell(`A${rowNum}`)
      mealTitleCell.value = `${mealName} (${mealDateFmt}) - ${group.guests} Guests`
      mealTitleCell.font = arial({ bold: true, size: 12 })
      rowNum++

      // Items in a grid, column-first fill
      const items = group.items
      const totalRows = Math.ceil(items.length / MENU_COLS)
      for (let r = 0; r < totalRows; r++) {
        for (let c = 0; c < MENU_COLS; c++) {
          const idx = c * totalRows + r
          if (items[idx]) {
            const cell = ws.getCell(rowNum + r, c + 1)
            cell.value = items[idx].name
            cell.font = arial({ bold: true, size: 11 })
            cell.border = {
              top: { style: "thin", color: { argb: "FFCCCCCC" } },
              bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
              left: { style: "thin", color: { argb: "FFCCCCCC" } },
              right: { style: "thin", color: { argb: "FFCCCCCC" } }
            }
          }
        }
      }
      rowNum += totalRows + 1 // gap after meal
    })

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
    if (event.notes) {
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
    const filename = `${safe(event.organizerName)}_${dateForName}_${safe(event.homeAddress || "nohome")}.xlsx`

    return new NextResponse(uint8, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    })
  } catch (error) {
    console.error("Error exporting event xlsx:", error)
    return NextResponse.json({ success: false, error: "Failed to export" }, { status: 500 })
  }
}
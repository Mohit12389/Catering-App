import { Paragraph, TableCell, TextRun, Tab, TabStopType, WidthType, VerticalAlign, type IBorderOptions } from "docx"

// CHANGED (2026-10-24): ONE Word table cell per ingredient — "name (note)  →  qty" — used
// by both Word exports (Event History and Categories Print). It used to be two cells
// (name | qty) with the line between them set to "none", but Pages / Google Docs /
// LibreOffice and Word's gridlines still showed that line, so it read as |Barfi|1kg|.
// Now the quantity sits at a right-aligned tab stop on the cell's right edge. The table
// keeps fixed, equal column widths, so the cells stay even. A long name wraps inside the
// cell and the quantity stays right-aligned on its last line.
export function docxIngredientCell(opts: {
  name: string
  notes?: string | null
  qty: string
  width: number                                              // cell width in twips
  sizes: { ing: number; ingNote: number }                    // half-points
  border: IBorderOptions
  margins: { top: number; bottom: number; left: number; right: number }
}): TableCell {
  const { name, notes, qty, width, sizes, border, margins } = opts
  return new TableCell({
    children: [new Paragraph({
      // right edge of the text area = cell width minus its left/right padding
      tabStops: [{ type: TabStopType.RIGHT, position: width - margins.left - margins.right }],
      children: [
        new TextRun({ text: name, size: sizes.ing }),
        ...(notes ? [new TextRun({ text: ` (${notes})`, size: sizes.ingNote, color: "B45309" })] : []),
        new TextRun({ children: [new Tab(), qty], bold: true, size: sizes.ing })
      ]
    })],
    width: { size: width, type: WidthType.DXA },
    margins,
    verticalAlign: VerticalAlign.CENTER,
    borders: { top: border, bottom: border, left: border, right: border }
  })
}

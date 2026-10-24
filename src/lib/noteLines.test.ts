import { describe, it, expect } from "vitest"
import { noteLines } from "./utils"

// Each line of a category note prints as its own cell in the ingredient grid.
describe("noteLines", () => {
  it("splits on Enter, one entry per line", () => {
    expect(noteLines("100 box=> 1kg bhaji\n20 box=> 1/2kg kaju katli\r\n10box=> 1kg mix sweets"))
      .toEqual(["100 box=> 1kg bhaji", "20 box=> 1/2kg kaju katli", "10box=> 1kg mix sweets"])
  })

  it("drops blank lines and trims spaces", () => {
    expect(noteLines("  a  \n\n   \nb\n")).toEqual(["a", "b"])
  })

  it("an old one-line note is one cell; no note is no cells", () => {
    expect(noteLines("deliver by 6am")).toEqual(["deliver by 6am"])
    expect(noteLines(null)).toEqual([])
    expect(noteLines(undefined)).toEqual([])
    expect(noteLines("")).toEqual([])
  })
})

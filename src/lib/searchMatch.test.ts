import { describe, it, expect } from "vitest"
import { matchesSearch, romanize } from "./searchMatch"

describe("romanize", () => {
  it("converts Devanagari letter by letter", () => {
    expect(romanize("पनीर")).toBe("panira")
    expect(romanize("आलू")).toBe("alu")
    expect(romanize("प्याज")).toBe("pyaja")
  })
  it("passes English through lowercased", () => {
    expect(romanize("Paneer Tikka")).toBe("paneer tikka")
  })
})

describe("matchesSearch — English typing finds Hindi names", () => {
  const cases: [string, string][] = [
    ["पनीर", "paneer"],
    ["पनीर", "panir"],
    ["आलू", "aloo"],
    ["आलू", "alu"],
    ["आटा", "aatta"],
    ["आटा", "atta"],
    ["लहसुन", "lahsun"],
    ["लहसुन", "lehsun"],
    ["प्याज", "pyaj"],
    ["प्याज़", "pyaaz"],
    ["धनिया", "dhaniya"],
    ["धनिया", "dhania"],
    ["घी", "ghee"],
    ["बैंगन", "baingan"],
    ["चीनी", "cheeni"],
    ["चीनी", "chini"],
    ["फूल गोभी", "phool gobhi"],
    ["फूल गोभी", "fool gobi"],
    ["पकोड़ा", "pakora"],
    ["पकोड़ा", "pakoda"],
    ["शक्कर", "shakkar"],
    ["शक्कर", "sakar"],
    ["मिर्च", "mirch"],
    ["दाल मखनी", "makhni"],
  ]
  it.each(cases)("%s ← %s", (name, query) => {
    expect(matchesSearch(name, query)).toBe(true)
  })

  it("matches a partly typed word", () => {
    expect(matchesSearch("पनीर टिक्का", "pan")).toBe(true)
  })
})

describe("matchesSearch — old behaviour kept", () => {
  it("empty query matches everything", () => {
    expect(matchesSearch("पनीर", "")).toBe(true)
    expect(matchesSearch("पनीर", "   ")).toBe(true)
  })
  it("plain substring still works, case-insensitive, for English and Hindi", () => {
    expect(matchesSearch("Paneer Tikka", "TIKKA")).toBe(true)
    expect(matchesSearch("पनीर टिक्का", "टिक्का")).toBe(true)
  })
  it("loose matching also forgives English spellings", () => {
    expect(matchesSearch("Paneer Tikka", "panir tika")).toBe(true)
  })
  it("missing text never matches a real query", () => {
    expect(matchesSearch(null, "paneer")).toBe(false)
    expect(matchesSearch(undefined, "paneer")).toBe(false)
  })
})

describe("matchesSearch — does not match unrelated names", () => {
  const cases: [string, string][] = [
    ["पनीर", "aloo"],
    ["आलू", "paneer"],
    ["लहसुन", "pyaj"],
    ["घी", "dal"],
    ["चीनी", "namak"],
  ]
  it.each(cases)("%s ✗ %s", (name, query) => {
    expect(matchesSearch(name, query)).toBe(false)
  })
})

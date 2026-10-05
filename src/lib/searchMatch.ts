// CHANGED: new file — lets English-keyboard typing find Hindi (Devanagari) names.
//
// Names are stored in Hindi (पनीर, आटा, लहसुन) but searched from an English keyboard
// ("paneer", "aatta", "lahsun"). A plain `name.includes(query)` can never match those.
//
// How it works: both the name and the query are turned into a loose "search key":
//   1. Devanagari → Latin letters, letter by letter (deterministic: प is always "p").
//   2. Smooth over the ways Hinglish spelling varies: ee→i, oo→u, z→j, f→ph, w→v,
//      drop the "h" of kh/gh/ch/th/dh/ph/bh/sh, drop every "a", collapse doubled letters.
//      So "paneer", "panir" and पनीर all become "pnir".
// A name matches if the plain text contains the query (old behaviour, unchanged) OR its
// key contains the query's key. It is approximate on purpose — over-matching a little in
// a search box is fine; missing the item the operator is looking for is not.

const INDEPENDENT_VOWELS: Record<string, string> = {
  "अ": "a", "आ": "a", "इ": "i", "ई": "i", "उ": "u", "ऊ": "u", "ऋ": "ri",
  "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au", "ऑ": "o", "ऍ": "e",
}

// Vowel signs (matras) — they replace a consonant's built-in "a".
const MATRAS: Record<string, string> = {
  "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "ृ": "ri",
  "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o", "ॅ": "e",
}

const CONSONANTS: Record<string, string> = {
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n",
  "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
  "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
  "य": "y", "र": "r", "ल": "l", "व": "v",
  "श": "sh", "ष": "sh", "स": "s", "ह": "h",
}

const SIGNS: Record<string, string> = { "ं": "n", "ँ": "n", "ः": "h" }

const VIRAMA = "्"
const NUKTA = "़"
// ड़ / ढ़ are spelled both "r" and "d" in English (पकोड़ा = pakora / pakoda), so they get a
// placeholder that looseKeys() expands into both spellings.
const FLAP = "R"

/** Devanagari → Latin, letter by letter. Latin text passes through lowercased. */
export function romanize(text: string): string {
  let out = ""
  let pendingA = false // a consonant was just written and still owns its built-in "a"
  // NFD splits precomposed nukta letters (ज़, ड़, फ़) into base letter + nukta.
  for (const ch of Array.from(text.normalize("NFD").toLowerCase())) {
    if (ch in MATRAS) { out += MATRAS[ch]; pendingA = false; continue }
    if (ch === VIRAMA) { pendingA = false; continue }
    if (ch === NUKTA) {
      // Only ड़/ढ़ change the search key; ज़→j, फ़→ph, क़→k are what looseKeys() folds them to anyway.
      if (out.endsWith("dh")) out = out.slice(0, -2) + FLAP
      else if (out.endsWith("d")) out = out.slice(0, -1) + FLAP
      continue
    }
    if (pendingA) { out += "a"; pendingA = false }
    if (ch in CONSONANTS) { out += CONSONANTS[ch]; pendingA = true; continue }
    if (ch in INDEPENDENT_VOWELS) { out += INDEPENDENT_VOWELS[ch]; continue }
    if (ch in SIGNS) { out += SIGNS[ch]; continue }
    out += ch
  }
  if (pendingA) out += "a"
  return out
}

function loosen(romanized: string): string {
  return romanized
    .replace(/w/g, "v")
    .replace(/z/g, "j")
    .replace(/q/g, "k")
    .replace(/f/g, "ph")
    .replace(/ee/g, "i")
    .replace(/oo/g, "u")
    .replace(/eh/g, "ah")                       // lehsun / lahsun
    .replace(/([bcdgjklmnpqrstvxyR])h+/g, "$1") // kh→k, chh→c, dh→d, sh→s …
    .replace(/a/g, "")                          // vowel "a" is the least reliable letter
    .replace(/[^a-z0-9R]/g, "")                 // spaces, brackets, unmapped symbols
    .replace(/([a-zR])\1+/g, "$1")              // atta→ta, kk→k (digits left alone)
}

const keyCache = new Map<string, string[]>()

/** The loose search key(s) for a piece of text — usually one, two when it contains ड़/ढ़. */
export function looseKeys(text: string): string[] {
  const cached = keyCache.get(text)
  if (cached) return cached
  const base = loosen(romanize(text))
  const keys = base.includes(FLAP)
    ? Array.from(new Set([base.replace(/R/g, "r"), base.replace(/R/g, "d")]))
    : [base]
  if (keyCache.size > 5000) keyCache.clear()
  keyCache.set(text, keys)
  return keys
}

/**
 * Does `text` match what the user typed? An empty query matches everything.
 * Use for NAMES (items, ingredients, categories, organizers, venues) — not for phone
 * numbers or event IDs, where a plain `includes` is the right check.
 */
export function matchesSearch(text: string | null | undefined, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (!text) return false
  if (text.toLowerCase().includes(q)) return true
  const queryKeys = looseKeys(q).filter(Boolean)
  if (queryKeys.length === 0) return false // query was only "a"s / symbols — nothing loose to match
  const textKeys = looseKeys(text)
  return queryKeys.some(qk => textKeys.some(tk => tk.includes(qk)))
}

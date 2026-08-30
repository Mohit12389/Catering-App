// =============================================
// MEAL DOMAIN CONSTANTS & HELPERS
// =============================================
// CHANGED: single source of truth for meal types, meal ordering and the
// composite meal key. Previously MEAL_TYPES was duplicated in 3 pages and the
// mealOrder rank map in 6 files (2 export routes + 4 pages), which is exactly
// the "a business rule living in 5 places is 5 chances to get it wrong" problem
// called out in CLAUDE.md. Adding a meal type is now a one-line change here.

// Dropdown options — Hindi labels are intentional, preserve exactly.
export const MEAL_TYPES = [
  { value: "breakfast", label: "Breakfast / नाश्ता" },
  { value: "lunch", label: "Lunch / दोपहर का भोजन" },
  { value: "high-tea", label: "High Tea / हाई टी" },
  { value: "dinner", label: "Dinner / रात का भोजन" },
  { value: "brunch", label: "Brunch / ब्रंच" },
  { value: "snacks", label: "Snacks / स्नैक्स" },
]

// Display rank — meals on the SAME date sort in this fixed order.
// Unknown labels sort last (99).
export const MEAL_ORDER: Record<string, number> = {
  breakfast: 1, brunch: 2, lunch: 3, "high-tea": 4, snacks: 5, dinner: 6
}

// Composite meal identity: `${label}::${YYYY-MM-DD}`.
// Keying by label alone merged two same-type meals on different dates
// (two breakfasts collapsing into one) — always use both parts.
export function mealKey(label: string | null | undefined, date: Date | string | null | undefined): string {
  const dateStr = date
    ? (date instanceof Date ? date.toISOString() : String(date)).split("T")[0]
    : ""
  return `${label || "default"}::${dateStr}`
}

// Canonical meal sort: date ascending first, then meal type rank.
export function compareMeals(
  a: { label?: string | null; date?: Date | string | null },
  b: { label?: string | null; date?: Date | string | null }
): number {
  const dateA = a.date ? new Date(a.date).getTime() : 0
  const dateB = b.date ? new Date(b.date).getTime() : 0
  if (dateA !== dateB) return dateA - dateB
  return (MEAL_ORDER[a.label || ""] || 99) - (MEAL_ORDER[b.label || ""] || 99)
}

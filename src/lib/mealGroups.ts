// =============================================
// EVENT PROJECTIONS: meals and ingredient categories
// =============================================
// CHANGED: extracted from 4 near-identical copies (event-docx, event-xlsx,
// event-history/[eventId], event-menu/[eventId]).
//
// A "meal" is NOT a stored entity — it is a grouping of EventItem rows by the
// composite key `${mealLabel}::${mealDate}` (see CLAUDE.md). That projection is
// the core of the domain, so it lives in exactly one place.
//
// DESIGN NOTE: these helpers own the *grouping mechanics* only (composite key,
// accumulate, sort). Each call site keeps its own projection via the `mapItem` /
// `mapIngredient` callbacks, because the call sites legitimately differ:
//   - exports default guests/perPlate to 0 (printed as "N Guests"),
//     the pages keep them null (so an unset value renders blank, not "0")
//   - exports group ingredients by category NAME (they don't select the id),
//     the pages group by category ID and need it for React keys / boughtBy
//   - only event-history filters out zero-quantity ingredients
// Forcing those into one shape would silently change printed output.

import { mealKey, compareMeals } from "./meals"

export interface MealGroup<TItem> {
  key: string
  label: string
  date: string | null
  guests: number | null
  perPlate: number | null
  items: TItem[]
}

// Normalises a Date or an ISO string to an ISO string.
// Exports receive a Prisma Date; pages receive an already-serialised string.
function toIso(d: Date | string | null | undefined): string | null {
  if (!d) return null
  return d instanceof Date ? d.toISOString() : String(d)
}

interface SourceItem {
  mealLabel?: string | null
  mealDate?: Date | string | null
  mealGuests?: number | null
  mealPerPlate?: number | null
}

/**
 * Group EventItem rows into meals, keyed by `${label}::${YYYY-MM-DD}`.
 * Returns groups sorted by date ascending, then meal-type rank.
 *
 * Meal metadata (guests/perPlate) is taken from the FIRST row of each group,
 * matching the existing behaviour — the fields are duplicated across a meal's
 * items by design (see CLAUDE.md, updateMany).
 */
export function groupIntoMeals<TSrc extends SourceItem, TItem>(
  eventItems: readonly TSrc[] | null | undefined,
  mapItem: (ei: TSrc) => TItem,
  opts: {
    /** Sort applied to items WITHIN each meal. Omit to preserve insertion order. */
    sortItems?: (a: TItem, b: TItem) => number
  } = {}
): MealGroup<TItem>[] {
  if (!eventItems || !Array.isArray(eventItems)) return []

  const groups: Record<string, MealGroup<TItem>> = {}

  for (const ei of eventItems) {
    const key = mealKey(ei.mealLabel, ei.mealDate)
    if (!groups[key]) {
      groups[key] = {
        key,
        label: ei.mealLabel || "default",
        date: toIso(ei.mealDate),
        guests: ei.mealGuests ?? null,
        perPlate: ei.mealPerPlate ?? null,
        items: []
      }
    }
    groups[key].items.push(mapItem(ei))
  }

  const result = Object.values(groups)
  if (opts.sortItems) result.forEach(g => g.items.sort(opts.sortItems))
  return result.sort(compareMeals)
}

// =============================================

export interface IngredientGroup<TIng> {
  categoryId: string
  categoryName: string
  sortOrder: number
  ingredients: TIng[]
}

/**
 * Group EventIngredient rows by ingredient category.
 * Categories sort by sortOrder ascending (category rank set in the inventory page).
 *
 * `getCategory` is supplied by the caller so each site keeps its own fallbacks —
 * exports pass name as the id (they don't select category.id), pages pass the
 * real id. Grouping by name is safe there because IngredientCategory is
 * @@unique([name, userId]).
 */
export function groupIngredientsByCategory<TSrc, TIng>(
  eventIngredients: readonly TSrc[] | null | undefined,
  getCategory: (ei: TSrc) => { id: string; name: string; sortOrder: number },
  mapIngredient: (ei: TSrc) => TIng,
  opts: {
    /** Return false to exclude a row entirely. */
    include?: (ei: TSrc) => boolean
    /** Sort applied to ingredients WITHIN each category. */
    sortIngredients?: (a: TIng, b: TIng) => number
    /**
     * Break equal sortOrder ties by category name. The pages do this; the
     * exports do NOT (they rely on stable-sort insertion order). Categories
     * default to sortOrder 0, so ties are common — this flag changes output.
     */
    tieBreakByName?: boolean
  } = {}
): IngredientGroup<TIng>[] {
  if (!eventIngredients || !Array.isArray(eventIngredients)) return []

  const groups: Record<string, IngredientGroup<TIng>> = {}

  for (const ei of eventIngredients) {
    if (opts.include && !opts.include(ei)) continue
    const cat = getCategory(ei)
    if (!groups[cat.id]) {
      groups[cat.id] = {
        categoryId: cat.id,
        categoryName: cat.name,
        sortOrder: cat.sortOrder,
        ingredients: []
      }
    }
    groups[cat.id].ingredients.push(mapIngredient(ei))
  }

  const result = Object.values(groups)
  if (opts.sortIngredients) result.forEach(g => g.ingredients.sort(opts.sortIngredients))

  return result.sort((a, b) =>
    opts.tieBreakByName
      ? (a.sortOrder - b.sortOrder) || a.categoryName.localeCompare(b.categoryName)
      : a.sortOrder - b.sortOrder
  )
}

/** Sort menu items by category rank, then name. Used by every export + detail page. */
export function compareByCategoryThenName(
  a: { categorySortOrder?: number; name: string },
  b: { categorySortOrder?: number; name: string }
): number {
  return (a.categorySortOrder || 0) - (b.categorySortOrder || 0) || a.name.localeCompare(b.name)
}

// =============================================
// SAVING EVENT INGREDIENT QUANTITIES
// =============================================
// CHANGED: extracted from app/api/events/[eventId]/ingredients/route.ts POST, which
// looped over the submitted ingredients and ran a findUnique per row, then an update
// OR (a second lookup plus a create). An event with 80 ingredients meant ~160 separate
// round-trips to Neon — several seconds for a save the operator does every day.
//
// The decision of what to update and what to create is pure, so it lives here and is
// tested directly; the route keeps only the batched reads and writes.

export interface IngredientSaveInput {
  ingredientId: string
  quantity: number
  /** Absent means "leave whatever is stored". null CLEARS it — the column is nullable. */
  notes?: string | null
  /** Not nullable in the schema (defaults to "normal"), so null is not a valid write. */
  status?: string
}

export interface IngredientUpdate {
  ingredientId: string
  data: { quantity: number; notes?: string | null; status?: string }
}

export interface IngredientCreate {
  ingredientId: string
  quantity: number
  priceAtEvent: number | null
  notes: string | null
}

/**
 * Split the submitted rows into updates (the event already has that ingredient) and
 * creates (it does not).
 *
 * Two details carried over from the original loop, because changing either would change
 * what gets saved:
 *  - on an UPDATE, notes and status are written only when the request actually included
 *    them. `undefined` means "don't touch", which is not the same as clearing them.
 *  - on a CREATE, priceAtEvent is taken from the ingredient's master rate, and
 *    `|| null` means a rate of 0 is stored as null exactly as before.
 *
 * A repeated ingredientId keeps the LAST entry. For an ingredient the event ALREADY
 * has this is exactly what the old loop did — the later update overwrote the earlier.
 * For a NEW ingredient it differs slightly: the old loop created the row from the first
 * entry and then updated it from the second, so `status` could be written and
 * priceAtEvent came from the create. Here it is a single create from the last entry.
 * That case is unreachable from the app — (eventId, ingredientId) is unique, so the
 * page has one row per ingredient to submit — and one create beats a create followed
 * by an update regardless. It is called out because the equivalence test excludes it
 * deliberately, rather than because nobody noticed.
 */
export function planIngredientSave(
  input: IngredientSaveInput[],
  existingIngredientIds: Set<string>,
  masterRateByIngredientId: Map<string, number | null>
): { updates: IngredientUpdate[]; creates: IngredientCreate[] } {
  const lastPerIngredient = new Map<string, IngredientSaveInput>()
  for (const row of input) lastPerIngredient.set(row.ingredientId, row)

  const updates: IngredientUpdate[] = []
  const creates: IngredientCreate[] = []

  for (const row of Array.from(lastPerIngredient.values())) {
    if (existingIngredientIds.has(row.ingredientId)) {
      updates.push({
        ingredientId: row.ingredientId,
        data: {
          quantity: row.quantity,
          ...(row.notes !== undefined && { notes: row.notes }),
          // `!= null` not `!== undefined`: EventIngredient.status is NOT nullable, so a
          // null from the client used to reach Prisma and throw. Skipping it instead
          // leaves the stored status alone, which is what "no status sent" means.
          ...(row.status != null && { status: row.status }),
        },
      })
    } else {
      creates.push({
        ingredientId: row.ingredientId,
        quantity: row.quantity,
        priceAtEvent: masterRateByIngredientId.get(row.ingredientId) || null,
        notes: row.notes || null,
      })
    }
  }

  return { updates, creates }
}

/** The ingredient ids that need their master rate looked up — i.e. the new ones only. */
export function newIngredientIds(
  input: IngredientSaveInput[],
  existingIngredientIds: Set<string>
): string[] {
  const ids = new Set<string>()
  for (const row of input) {
    if (!existingIngredientIds.has(row.ingredientId)) ids.add(row.ingredientId)
  }
  return Array.from(ids)
}

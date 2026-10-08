// =============================================
// MASTER PRICE CHANGE (one rule, two entry points)
// =============================================
// CHANGED: extracted from api/ingredients/bulk-price-update (no-date branch) so the
// Edit Ingredient dialog can change the master price through the SAME rule.
//
// THE RULE: an event ingredient with priceAtEvent = null is priced at the CURRENT
// master rate (bills, revenue stats, procurement, category payments all do
// `priceAtEvent ?? ratePerUnit`). So changing the master rate alone would silently
// re-price every past event. Before the master changes, those null rows are locked
// at the OLD rate; only events created afterwards get the new one.
//
// Call it inside prisma.$transaction so the lock and the master write land together.

import type { Prisma } from "@prisma/client"

/** A usable master price: a finite number >= 0. Returns null for anything else. */
export function parseMasterPrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Lock existing events at the old master price, then set the new one.
 * Returns null when the ingredient isn't found for this user (caller sends 404).
 */
export async function setMasterPrice(
  tx: Prisma.TransactionClient,
  ingredientId: string,
  effectiveUserId: string,
  newPrice: number
): Promise<{ oldPrice: number; lockedCount: number } | null> {
  // Read the price inside the transaction, not from the form: if someone changed it
  // since the dialog opened, the lock must use what is actually stored now.
  const ingredient = await tx.ingredient.findFirst({
    where: { id: ingredientId, userId: effectiveUserId },
    select: { ratePerUnit: true }
  })
  if (!ingredient) return null
  const oldPrice = ingredient.ratePerUnit || 0

  const locked = await tx.eventIngredient.updateMany({
    where: { ingredientId, priceAtEvent: null, event: { userId: effectiveUserId } },
    data: { priceAtEvent: oldPrice }
  })

  await tx.ingredient.update({
    where: { id: ingredientId },
    data: { ratePerUnit: newPrice }
  })

  return { oldPrice, lockedCount: locked.count }
}

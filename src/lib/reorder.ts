// =============================================
// CHANGED: single implementation of the shift-and-place reorder algorithm.
// It was previously written out three times (itemCategory / ingredientCategory /
// ingredient) differing only in the Prisma delegate, the shift scope and the
// response message — three copies that had already started to drift.
//
// The `oldSortOrder === 0` branch is deliberate and preserved verbatim: a row
// that has never been ranked (default 0) is treated as "moving up" so it makes
// room at the target position instead of shifting the range above it.
// =============================================

// CHANGED: typed (was `any` everywhere). Method syntax on purpose — it lets the three
// Prisma delegates (itemCategory / ingredientCategory / ingredient) satisfy this shape.
export type Scope = Record<string, unknown>
export type SortRow = { sortOrder: number } & Record<string, unknown>
export type SortableDelegate = {
  findFirst(args: { where: Scope }): Promise<SortRow | null>
  updateMany(args: { where: Scope; data: { sortOrder: { increment: number } | { decrement: number } } }): Promise<unknown>
  update(args: { where: { id: string }; data: { sortOrder: number } }): Promise<unknown>
}

export async function reorder(
  model: SortableDelegate,
  opts: {
    id: string
    newSortOrder: number
    /** Ownership scope — also bounds which rows may be shifted. */
    ownerScope: Scope
    /** Extra shift scope from the found row (ingredients shift only within their own category). */
    narrowScope?: (record: SortRow) => Scope
  }
): Promise<boolean> {
  const { id, newSortOrder: sortOrder, ownerScope, narrowScope } = opts

  const record = await model.findFirst({ where: { id, ...ownerScope } })
  if (!record) return false

  const oldSortOrder = record.sortOrder
  if (oldSortOrder === sortOrder) return true

  const shiftScope = {
    ...ownerScope,
    ...(narrowScope ? narrowScope(record) : {}),
    id: { not: id }
  }

  if (sortOrder < oldSortOrder || oldSortOrder === 0) {
    // Moving UP (or from unset): shift rows at or after the new position DOWN by 1
    await model.updateMany({
      where: { ...shiftScope, sortOrder: { gte: sortOrder } },
      data: { sortOrder: { increment: 1 } }
    })
  } else {
    // Moving DOWN: shift rows between old+1 and the new position UP by 1
    await model.updateMany({
      where: { ...shiftScope, sortOrder: { gt: oldSortOrder, lte: sortOrder } },
      data: { sortOrder: { decrement: 1 } }
    })
  }

  await model.update({ where: { id }, data: { sortOrder } })
  return true
}

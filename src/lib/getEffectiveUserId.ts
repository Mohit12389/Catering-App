// =============================================
// ROLE-BASED ACCESS: Helper to get effective userId
// =============================================
// Staff members see owner's data. This helper returns:
// - For owner: their own id
// - For staff: their owner's id (ownerId)
// Use this in ALL API routes instead of `dbUser.id`

export function getEffectiveUserId(dbUser: {
  id: string
  role: string
  ownerId: string | null
}): string {
  // CHANGED: Staff queries use the owner's userId
  return dbUser.role === "staff" && dbUser.ownerId ? dbUser.ownerId : dbUser.id
}
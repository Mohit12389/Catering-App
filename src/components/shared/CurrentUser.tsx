"use client"

// CHANGED: new. The (dashboard) layout already knows the signed-in user's role and
// business name (it needs them for the navbar and the onboarding redirect). Pages used
// to fetch /api/user/organization AGAIN just to learn the role — an extra India→USA
// round trip on every page, and until it answered staff briefly saw owner-only
// columns (the default was "owner"). The layout now hands these down once.
//
// UI only: the APIs still enforce owner/staff themselves (withAuth ownerOnly).

import { createContext, useContext } from "react"

export interface CurrentUser {
  /** DB user id (the signed-in person, not the effective owner). */
  id: string
  role: string | null
  /** Owner's business name — for staff this is their owner's. */
  organizationName: string | null
}

const CurrentUserContext = createContext<CurrentUser | null>(null)

export function CurrentUserProvider({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>
}

export function useCurrentUser(): CurrentUser {
  const user = useContext(CurrentUserContext)
  if (!user) throw new Error("useCurrentUser must be used inside the (dashboard) layout")
  return user
}

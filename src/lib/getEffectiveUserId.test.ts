import { describe, it, expect } from "vitest"
import { getEffectiveUserId } from "./getEffectiveUserId"

// This function is the entire enforcement mechanism for the owner/staff data
// boundary (see CLAUDE.md). Every case here maps to a real access-control
// scenario — a regression here means staff/owner data leaks or splits.
describe("getEffectiveUserId", () => {
  it("returns the owner's own id for an owner account", () => {
    const owner = { id: "owner-1", role: "owner", ownerId: null }
    expect(getEffectiveUserId(owner)).toBe("owner-1")
  })

  it("returns the owner's id (not the staff account's own id) for a staff account", () => {
    const staff = { id: "staff-1", role: "staff", ownerId: "owner-1" }
    expect(getEffectiveUserId(staff)).toBe("owner-1")
  })

  it("falls back to the account's own id if a staff account has no ownerId", () => {
    const orphanedStaff = { id: "staff-2", role: "staff", ownerId: null }
    expect(getEffectiveUserId(orphanedStaff)).toBe("staff-2")
  })

  it("ignores ownerId for non-staff roles even if it's set", () => {
    const ownerWithStrayOwnerId = { id: "owner-2", role: "owner", ownerId: "someone-else" }
    expect(getEffectiveUserId(ownerWithStrayOwnerId)).toBe("owner-2")
  })
})

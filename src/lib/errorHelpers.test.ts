import { describe, it, expect } from "vitest"
import { errorMessage, isUniqueViolation } from "./utils"

// CHANGED: covers the helpers that replaced `catch (error: any)` across the app.

describe("errorMessage", () => {
  it("returns the message of an Error (and subclasses like ApiError)", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom")
    class ApiError extends Error {}
    expect(errorMessage(new ApiError("nope"))).toBe("nope")
  })

  it("reads a plain { message } object, as error.message did", () => {
    expect(errorMessage({ message: "plain" })).toBe("plain")
  })

  it("is undefined when there is no string message, as error.message was", () => {
    for (const v of [undefined, null, "text", 42, {}, { message: 5 }]) {
      expect(errorMessage(v)).toBeUndefined()
    }
  })
})

describe("isUniqueViolation", () => {
  it("is true only for Prisma's P2002", () => {
    expect(isUniqueViolation({ code: "P2002" })).toBe(true)
    expect(isUniqueViolation({ code: "P2025" })).toBe(false)
    expect(isUniqueViolation(new Error("x"))).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
  })
})

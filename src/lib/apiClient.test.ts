import { describe, it, expect, vi, beforeEach } from "vitest"
import { api, apiRequest, ApiError } from "./apiClient"

const mockFetch = (status: number, payload: any, ok?: boolean) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: ok ?? (status >= 200 && status < 300),
    status,
    json: async () => { if (payload === undefined) throw new Error("not json"); return payload }
  }) as any
}

beforeEach(() => { vi.restoreAllMocks() })

describe("apiRequest", () => {
  it("unwraps the { success, data } envelope", async () => {
    mockFetch(200, { success: true, data: { id: "1" } })
    await expect(apiRequest("/api/x")).resolves.toEqual({ id: "1" })
  })

  it("throws the server's error message on success:false, even with HTTP 200", async () => {
    // this is the case the old `if (res.ok)` delete handlers silently swallowed
    mockFetch(200, { success: false, error: "Category already exists" })
    await expect(apiRequest("/api/x")).rejects.toThrow("Category already exists")
  })

  it("throws on a non-2xx response", async () => {
    mockFetch(404, { success: false, error: "Category not found" })
    await expect(apiRequest("/api/x")).rejects.toThrow("Category not found")
  })

  it("still throws when the body isn't JSON at all", async () => {
    mockFetch(500, undefined)
    await expect(apiRequest("/api/x")).rejects.toThrow(/Request failed \(500\)/)
  })

  it("exposes the HTTP status on the error", async () => {
    mockFetch(403, { success: false, error: "Access denied" })
    await expect(apiRequest("/api/x")).rejects.toMatchObject({ status: 403, name: "ApiError" })
  })

  it("sends JSON headers and a serialised body for writes", async () => {
    mockFetch(201, { success: true, data: null })
    await api.post("/api/items", { name: "Poha" })
    expect(global.fetch).toHaveBeenCalledWith("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Poha" })
    })
  })

  it("omits body/headers entirely for a DELETE with no payload", async () => {
    mockFetch(200, { success: true, data: null })
    await api.del("/api/items?id=1")
    expect(global.fetch).toHaveBeenCalledWith("/api/items?id=1", { method: "DELETE" })
  })

  it("ApiError is a real Error (so existing catch blocks reading .message still work)", async () => {
    mockFetch(400, { success: false, error: "bad" })
    const err: any = await apiRequest("/api/x").catch(e => e)
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.message).toBe("bad")
  })
})

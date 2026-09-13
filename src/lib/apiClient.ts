// =============================================
// API CLIENT (write side)
// =============================================
// CHANGED: the app had 54 hand-rolled fetch() calls, each repeating
// fetch -> res.json() -> check data.success -> throw -> catch -> toast.
// They had already drifted: most check `data.success`, but the delete handlers
// in customize-inventory only checked `res.ok`, so a failed delete showed NO
// error at all — it just silently did nothing.
//
// Reads still go through useSWRFetch; this covers the mutation side.

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = "ApiError"
  }
}

type Method = "POST" | "PUT" | "PATCH" | "DELETE" | "GET"

/**
 * Performs a request and unwraps the app's `{ success, data, error }` envelope.
 * Throws ApiError when the request fails OR when the envelope reports failure —
 * so a caller can never accidentally treat a failed write as a success.
 */
/** Envelope shape the API routes return. */
export interface ApiEnvelope<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

async function request(
  url: string,
  opts: { method?: Method; body?: unknown } = {}
): Promise<ApiEnvelope> {
  const { method = "GET", body } = opts

  const res = await fetch(url, {
    method,
    ...(body !== undefined
      ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      : {})
  })

  let payload: any = null
  try {
    payload = await res.json()
  } catch {
    // non-JSON response (e.g. an HTML error page)
  }

  if (!res.ok || !payload || payload.success === false) {
    throw new ApiError(
      payload?.error || `Request failed (${res.status})`,
      res.status
    )
  }

  return payload as ApiEnvelope
}

export async function apiRequest<T = unknown>(
  url: string,
  opts: { method?: Method; body?: unknown } = {}
): Promise<T> {
  return (await request(url, opts)).data as T
}

export const api = {
  get:  <T = unknown>(url: string) => apiRequest<T>(url),
  post: <T = unknown>(url: string, body?: unknown) => apiRequest<T>(url, { method: "POST", body }),
  put:  <T = unknown>(url: string, body?: unknown) => apiRequest<T>(url, { method: "PUT", body }),
  patch:<T = unknown>(url: string, body?: unknown) => apiRequest<T>(url, { method: "PATCH", body }),
  del:  <T = unknown>(url: string) => apiRequest<T>(url, { method: "DELETE" }),
  /**
   * The full envelope, for the handful of routes that answer with `message`
   * rather than `data` — bulk-price-update explains what it changed, and that
   * text is shown to the operator.
   */
  postRaw: (url: string, body?: unknown) => request(url, { method: "POST", body }),
}

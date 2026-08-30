// =============================================
// REQUEST BODY VALIDATION (money routes first)
// =============================================
// CHANGED: the app had no validation layer — every `await req.json()` produced
// `any` and was destructured straight into arithmetic. In bills/route.ts that
// means `items.reduce((s, i) => s + i.quantity * i.rate, 0)` yields NaN if any
// quantity/rate is missing or a string, and the NaN is persisted as the bill
// total. That is a real-money bug class, so validation starts here.
//
// ROLLOUT — deliberately log-only by default:
// Turning on rejection immediately could start refusing input the app has been
// accepting for months (e.g. numbers arriving as strings). Instead, invalid
// bodies are LOGGED and still processed exactly as before. Watch the logs; once
// they are quiet, set VALIDATE_ENFORCE=true to switch on 400s. Nothing else
// needs to change.

import { NextResponse } from "next/server"
import type { ZodType } from "zod"

/** Flip to "true" in the environment to start rejecting invalid bodies. */
export const VALIDATION_ENFORCED = process.env.VALIDATE_ENFORCE === "true"

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse }

/**
 * Validate a parsed request body.
 * - enforced:  invalid input -> 400 with the first error message
 * - log-only:  invalid input -> console.warn, and the ORIGINAL body is returned
 *              unchanged so existing behaviour is bit-for-bit preserved
 */
export function validateBody<T>(
  schema: ZodType<T>,
  body: unknown,
  routeLabel: string
): ValidationResult<T> {
  const parsed = schema.safeParse(body)

  if (parsed.success) {
    return { ok: true, data: parsed.data }
  }

  const issues = parsed.error.issues
    .map(i => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ")

  if (!VALIDATION_ENFORCED) {
    console.warn(`[validation:log-only] ${routeLabel} — ${issues}`)
    // Pass the raw body straight through: log-only must not change behaviour.
    return { ok: true, data: body as T }
  }

  console.error(`[validation:rejected] ${routeLabel} — ${issues}`)
  return {
    ok: false,
    response: NextResponse.json({ success: false, error: issues }, { status: 400 })
  }
}

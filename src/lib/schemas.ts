// =============================================
// ZOD SCHEMAS — money routes
// =============================================
// CHANGED: new. Coercion is used on numbers because the frontend sends some
// values as strings (e.g. an <input> value); coercing matches what the routes
// already do with parseFloat/parseInt, so enforcing later won't break callers.

import { z } from "zod"

export const advancePaymentSchema = z.object({
  eventId: z.string().min(1, "eventId is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  paidDate: z.string().min(1, "paidDate is required"),
  notes: z.string().nullish(),
})
export type AdvancePaymentInput = z.infer<typeof advancePaymentSchema>

export const billItemSchema = z.object({
  description: z.string().min(1, "Item description is required"),
  // These two feed `quantity * rate` — a missing/NaN value would be persisted
  // as the bill total, which is the bug this schema exists to prevent.
  quantity: z.coerce.number().finite("Quantity must be a number").nonnegative(),
  rate: z.coerce.number().finite("Rate must be a number").nonnegative(),
  eventId: z.string().nullish(),
})

export const billSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  address: z.string().nullish(),
  clientGstNo: z.string().nullish(),
  items: z.array(billItemSchema).min(1, "At least one item is required"),
  discountType: z.enum(["percentage", "fixed"]).nullish(),
  discountValue: z.coerce.number().finite().nonnegative().default(0),
  sgst: z.coerce.number().finite().nonnegative().default(0),
  cgst: z.coerce.number().finite().nonnegative().default(0),
  notes: z.string().nullish(),
})
export type BillInput = z.infer<typeof billSchema>

// NOTE: this route marks a category paid across MANY events at once, so it takes
// eventIds[]. The amount is computed server-side from the event's ingredients —
// it is deliberately NOT accepted from the client.
export const categoryPaymentSchema = z.object({
  eventIds: z.array(z.string().min(1)).min(1, "At least one eventId is required"),
  ingredientCategoryId: z.string().min(1, "ingredientCategoryId is required"),
  categoryName: z.string().min(1, "categoryName is required"),
  notes: z.string().nullish(),
})
export type CategoryPaymentInput = z.infer<typeof categoryPaymentSchema>

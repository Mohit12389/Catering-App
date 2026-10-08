// Base Types
export interface User {
  id: string
  clerkId: string
  email: string
  name?: string | null
  role?: string          // ADDED
  ownerId?: string | null // ADDED
}

// Category Types
export interface ItemCategory {
  id: string
  name: string
  sortOrder?: number
  items?: Item[]
}

export interface IngredientCategory {
  id: string
  name: string
  sortOrder?: number
  ingredients?: Ingredient[]
}

// Item Types
export interface Item {
  id: string
  name: string
  description?: string | null
  categoryId: string
  category?: ItemCategory
  itemIngredients?: ItemIngredient[]
}

export interface Ingredient {
  id: string
  name: string
  unit: string
  ratePerUnit?: number | null
  categoryId: string
  sortOrder?: number
  category?: IngredientCategory
}

export interface IngredientPriceHistory {
  id: string
  ingredientId: string
  price: number
  startDate: string | Date
  endDate: string | Date
}

// Recipe (Item-Ingredient Link)
export interface ItemIngredient {
  id: string
  itemId: string
  ingredientId: string
  item?: Item
  ingredient?: Ingredient
}

// Event Types
export interface Event {
  id: string
  eventId: string
  organizerName: string
  phoneNumber: string
  location: string
  homeAddress?: string | null   // CHANGED: was missing here but present in schema + used across the app
  bookingDate: string | Date
  functionDate: string | Date
  functionTime: string
  menuCreationDate?: string | Date | null
  guestCount: number
  perPlatePrice: number
  totalAmount: number
  advancePayment: number
  status: 'active' | 'completed' | 'cancelled'
  notes?: string | null
  userId: string
  eventItems?: EventItem[]
  eventIngredients?: EventIngredient[]
  eventCategorySettings?: EventCategorySetting[]
  advancePayments?: AdvancePayment[]
  mealLabels?: MealLabel[]
}

// EventItem now carries meal label info
export interface EventItem {
  id: string
  eventId: string
  itemId: string
  mealLabel?: string | null
  mealDate?: string | Date | null
  mealGuests?: number | null
  mealPerPlate?: number | null
  mealNotes?: string | null  // CHANGED: per-meal note
  item?: Item
}

// Meal label summary (derived from EventItems for card display)
export interface MealLabel {
  label: string
  date?: string | Date | null
  guests?: number | null
}

export interface AdvancePayment {
  id: string
  eventId: string
  amount: number
  paidDate: string | Date
  notes?: string | null
  createdAt: string | Date
}

// CHANGED: the real set of values written to EventIngredient.status.
// Was 'normal' | 'added' | 'removed' — but 'added' is never written anywhere,
// while 'new' (events/[eventId]/route.ts) and 'shared' (events/copy/route.ts) are.
export type IngredientStatus = 'normal' | 'new' | 'removed' | 'shared'

export interface EventIngredient {
  id: string
  eventId: string
  ingredientId: string
  quantity: number
  priceAtEvent?: number | null
  status: IngredientStatus       // CHANGED: was a union that did not match the DB
  notes?: string | null          // CHANGED: packing/prep instructions, printed for the vendor
  ingredient?: Ingredient
}

export interface EventCategorySetting {
  id: string
  eventId: string
  ingredientCategoryId: string
  boughtBy: 'caterer' | 'client'
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// Form Types
export interface CreateEventForm {
  organizerName: string
  phoneNumber: string
  location: string
  functionDate: string
  functionTime: string
  guestCount: number
  perPlatePrice?: number
  notes?: string
  selectedItems: string[]
}

// Aggregated Types
export interface AggregatedIngredient {
  id: string
  name: string
  unit: string
  quantity: number
  ratePerUnit?: number | null
  categoryId: string
  categoryName: string
  boughtBy?: 'caterer' | 'client'
}

// Categories Print Types
export interface CategoryPrintEvent {
  eventId: string
  organizerName: string
  phoneNumber: string
  location: string
  functionDate: string | Date
  ingredients: {
    name: string
    quantity: number
    unit: string
  }[]
}
// CHANGED: one row of GET /api/events, as the event-history and event-menu list pages
// receive it (JSON, so dates are strings). Replaces `useSWRFetch<any[]>` on both pages.
export interface EventListMeal {
  label: string
  date: string | null
  guests: number | null
}

export interface EventListRow {
  id: string
  eventId: string
  organizerName: string
  phoneNumber: string
  location: string
  homeAddress: string | null
  bookingDate: string
  functionDate: string
  functionTime: string
  menuCreationDate: string | null
  guestCount: number
  perPlatePrice: number
  totalAmount: number
  /** Stripped from the response for staff. */
  advancePayment?: number
  status: string
  notes: string | null
  eventItems: {
    id: string
    itemId: string
    mealLabel: string | null
    mealDate: string | null
    mealGuests: number | null
    mealPerPlate: number | null
    item: { id: string; name: string; category: { id: string; name: string } }
  }[]
  /** Only a "has quantities" marker: [] or one placeholder row. */
  eventIngredients: { id: string; quantity: number }[]
  hasPendingIngredients: boolean
  mealLabels: EventListMeal[]
  lastMealDate: string | null
  billedAs: { billId: string; billNumber: string; amount: number } | null
  receivable: number
}

// CHANGED: GET /api/events/[eventId] as the event-history and event-menu DETAIL pages
// receive it (JSON, so dates are strings). Replaces `useState<any>` on both pages.
// Staff responses leave out advancePayment / advancePayments / billedAs / receivable.
export interface EventDetailItem {
  id: string
  itemId: string
  mealLabel: string | null
  mealDate: string | null
  mealGuests: number | null
  mealPerPlate: number | null
  mealNotes: string | null
  position: number | null
  item: { id: string; name: string; category: { id: string; name: string; sortOrder: number } }
}

export interface EventDetailIngredient {
  id: string
  ingredientId: string
  quantity: number
  priceAtEvent: number | null
  status: string
  notes: string | null
  ingredient: {
    id: string; name: string; unit: string; ratePerUnit: number
    category: { id: string; name: string; sortOrder: number }
  }
}

export interface EventDetail {
  id: string
  eventId: string
  organizerName: string
  phoneNumber: string
  location: string
  homeAddress: string | null
  bookingDate: string
  functionDate: string
  functionTime: string
  menuCreationDate: string | null
  guestCount: number
  perPlatePrice: number
  totalAmount: number
  status: string
  notes: string | null
  eventItems: EventDetailItem[]
  eventIngredients: EventDetailIngredient[]
  eventCategorySettings: { id: string; ingredientCategoryId: string; boughtBy: string }[]
  lastMealDate: string | null
  advancePayment?: number
  advancePayments?: { id: string; amount: number; paidDate: string; notes: string | null; createdAt: string }[]
  billedAs?: {
    billId: string; billNumber: string; amount: number
    itemsTotal: number; discountAmount: number; taxAmount: number
  } | null
  receivable?: number
}

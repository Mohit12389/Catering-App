// Base Types
export interface User {
  id: string
  clerkId: string
  email: string
  name?: string | null
}

// Category Types
export interface ItemCategory {
  id: string
  name: string
  items?: Item[]
}

export interface IngredientCategory {
  id: string
  name: string
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

export interface EventIngredient {
  id: string
  eventId: string
  ingredientId: string
  quantity: number
  priceAtEvent?: number | null
  status: 'normal' | 'added' | 'removed'
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
// =============================================
// BILLING STATS + PROCUREMENT TYPES
// =============================================
// CHANGED: moved out of billing/stats/page.tsx, which declared ~95 lines of interfaces
// before its component. They are shared by the extracted PieChart, CategoryDetail and
// IngredientRow, so they live here rather than being re-declared.

export interface EventBreakdown {
  eventId: string
  organizerName: string
  functionDate: string
  guestCount: number
  billAmount: number
  procurementCost: number
  profit: number
  mealLabels?: { label: string; date: string | null; guests: number; perPlate: number }[]
}

export interface Stats {
  totalRevenue: number
  totalPaid: number
  totalPending: number
  billCount: number
  // CHANGED: this page counts EVENTS now, not bills. An event is the thing the owner
  // thinks about — a bill is a document describing one or more of them — and the old
  // bill counts left every un-invoiced event invisible.
  eventCount: number
  stageCounts: {
    upcoming: number
    done: number
    completed: number
    cancelled: number
  }
  // CHANGED: billed is its own fact, not a stage — an invoiced event still has a place
  // on the timeline.
  billedCount: number
  unbilledCount: number
  statusCounts: {
    paid: number
    partial: number
    unpaid: number
    none: number
  }
  weeklyData: { day: string; revenue: number; paid: number }[]
  monthlyData: { month: string; revenue: number; paid: number }[]
  profitData?: { month: string; revenue: number; procurementCost: number; profit: number; eventBreakdown?: EventBreakdown[] }[]
}

export interface ProcurementEventData {
  eventId: string
  eventDbId: string
  organizerName: string
  functionDate: string
  location: string
  guestCount: number
  categoryCost: number
  boughtBy: string
  isPaid: boolean
  paymentId?: string
  paymentDate?: string
  paymentNotes?: string
}

export interface ProcurementIngredientPerEvent {
  eventId: string
  eventDbId: string
  organizerName: string
  functionDate: string
  quantity: number
  pricePerUnit: number
  cost: number
}

export interface ProcurementIngredient {
  ingredientId: string
  name: string
  unit: string
  totalQuantity: number
  totalCost: number
  perEvent: ProcurementIngredientPerEvent[]
}

export interface ProcurementCategory {
  categoryId: string
  categoryName: string
  totalCost: number
  events: ProcurementEventData[]
  ingredients: ProcurementIngredient[]
}

export interface PieChartItem {
  categoryId: string
  categoryName: string
  totalCost: number
  percentage: number
  eventCount: number
  ingredientCount: number
}

export interface ProcurementData {
  summary: {
    grandTotal: number
    totalPaid: number
    totalUnpaid: number
    totalEvents: number
    totalCategories: number
    dateRange: { start: string; end: string }
  }
  pieChartData: PieChartItem[]
  categories: ProcurementCategory[]
  allCategories: { id: string; name: string }[]
}

// =============================================
// PIE CHART COLORS

// =============================================
// BILL SHAPES
// =============================================
// CHANGED: BillItem was declared identically in the register page and the composer, and
// Bill only in the register. Two copies of a money shape is two places for a field to go
// missing when the API changes — and the API now overrides paidAmount and status with
// derived values, which is exactly the sort of thing a stale second copy hides.

export interface BillLineItem {
  id?: string
  description: string
  quantity: number
  rate: number
  amount: number
  /** Which EVENT this line belongs to. Read back to tell what is billed, and for how much. */
  eventId?: string
}

export interface BillRecord {
  id: string
  billNumber: string
  customerName: string
  phoneNumber: string
  address?: string
  clientGstNo?: string
  billDate: string
  subtotal: number
  discountType?: string
  discountValue: number
  discountAmount: number
  sgst: number
  cgst: number
  totalAmount: number
  /** DERIVED server-side from the payments of the events this bill covers. */
  paidAmount: number
  /** DERIVED: paid / partial / unpaid. Never set by a button. */
  status: string
  notes?: string
  items: BillLineItem[]
  advanceTotal?: number
}

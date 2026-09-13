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
  statusCounts: {
    paid: number
    partial: number
    unpaid: number
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

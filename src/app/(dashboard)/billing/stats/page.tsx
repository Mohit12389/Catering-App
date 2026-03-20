"use client"

import { useState, useMemo, useCallback } from "react"
import { 
  TrendingUp, 
  IndianRupee, 
  Receipt, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  BarChart3,
  Calendar,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  Package,
  Filter,
  Search,
  Check,
  X,
  Undo2,
  FileText,
  MapPin,
  Users,
  Loader2
} from "lucide-react"
import { Button, Input } from "@/components/ui"
import { Card, CardHeader, CardTitle, CardContent, Loading, Badge } from "@/components/shared"
import { useSWRFetch } from "@/hooks/useSWRFetch"
import { useToast } from "@/hooks/useToast"
import { formatDate, cn } from "@/lib/utils"

// =============================================
// TYPES
// =============================================

interface EventBreakdown {
  eventId: string
  organizerName: string
  functionDate: string
  guestCount: number
  billAmount: number
  procurementCost: number
  profit: number
  mealLabels?: { label: string; date: string | null; guests: number; perPlate: number }[]
}

interface Stats {
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

interface ProcurementEventData {
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

interface ProcurementIngredientPerEvent {
  eventId: string
  eventDbId: string
  organizerName: string
  functionDate: string
  quantity: number
  pricePerUnit: number
  cost: number
}

interface ProcurementIngredient {
  ingredientId: string
  name: string
  unit: string
  totalQuantity: number
  totalCost: number
  perEvent: ProcurementIngredientPerEvent[]
}

interface ProcurementCategory {
  categoryId: string
  categoryName: string
  totalCost: number
  events: ProcurementEventData[]
  ingredients: ProcurementIngredient[]
}

interface PieChartItem {
  categoryId: string
  categoryName: string
  totalCost: number
  percentage: number
  eventCount: number
  ingredientCount: number
}

interface ProcurementData {
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

const PIE_COLORS = [
  "#4a7c59", "#e07a3a", "#3b82f6", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f59e0b", "#6366f1", "#84cc16",
  "#06b6d4", "#f43f5e", "#a855f7", "#22c55e", "#d97706",
  "#0ea5e9", "#e11d48", "#7c3aed", "#10b981", "#f97316",
  "#6d28d9", "#059669", "#dc2626", "#2563eb", "#ca8a04"
]

// =============================================
// PIE CHART COMPONENT (Pure CSS/SVG)
// =============================================

function PieChart({ 
  data, 
  selectedCategory, 
  onSelect 
}: { 
  data: PieChartItem[]
  selectedCategory: string | null
  onSelect: (catId: string | null) => void
}) {
  const total = data.reduce((sum, d) => sum + d.totalCost, 0)
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No data for selected date range
      </div>
    )
  }

  // Build SVG pie chart paths
  const radius = 100
  const cx = 120
  const cy = 120
  let currentAngle = -90 // Start from top

  const slices = data.map((item, idx) => {
    const angle = (item.totalCost / total) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle

    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180

    const x1 = cx + radius * Math.cos(startRad)
    const y1 = cy + radius * Math.sin(startRad)
    const x2 = cx + radius * Math.cos(endRad)
    const y2 = cy + radius * Math.sin(endRad)

    const largeArc = angle > 180 ? 1 : 0

    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`

    const isSelected = selectedCategory === item.categoryId
    const isOtherSelected = selectedCategory !== null && !isSelected

    return {
      ...item,
      path,
      color: PIE_COLORS[idx % PIE_COLORS.length],
      isSelected,
      isOtherSelected,
      idx
    }
  })

  return (
    <div className="flex flex-col lg:flex-row items-center gap-6">
      {/* SVG Pie */}
      <div className="relative shrink-0">
        <svg width="240" height="240" viewBox="0 0 240 240">
          {slices.map((slice) => (
            <path
              key={slice.categoryId}
              d={slice.path}
              fill={slice.color}
              stroke="white"
              strokeWidth="2"
              opacity={slice.isOtherSelected ? 0.3 : 1}
              className="cursor-pointer transition-opacity duration-200"
              onClick={() => onSelect(slice.isSelected ? null : slice.categoryId)}
            />
          ))}
          {/* Center circle for donut effect */}
          <circle cx={cx} cy={cy} r="50" fill="white" className="dark:fill-gray-900" />
          <text x={cx} y={cy - 8} textAnchor="middle" className="fill-current text-xs font-medium">
            Total
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" className="fill-current text-sm font-bold">
            ₹{total > 100000 ? `${(total / 1000).toFixed(0)}K` : total.toLocaleString()}
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex-1 w-full max-h-[300px] overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {slices.map((slice) => (
            <button
              key={slice.categoryId}
              onClick={() => onSelect(slice.isSelected ? null : slice.categoryId)}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg text-left transition-all text-sm",
                slice.isSelected 
                  ? "bg-muted ring-2 ring-primary" 
                  : "hover:bg-muted/50",
                slice.isOtherSelected && "opacity-40"
              )}
            >
              <div 
                className="w-3 h-3 rounded-full shrink-0" 
                style={{ backgroundColor: slice.color }} 
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{slice.categoryName}</p>
                <p className="text-xs text-muted-foreground">
                  ₹{slice.totalCost.toLocaleString()} ({slice.percentage.toFixed(1)}%)
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// =============================================
// CATEGORY DETAIL COMPONENT
// =============================================

function CategoryDetail({ 
  category,
  onMarkPaid,
  onUnmarkPaid,
  markingPayment 
}: { 
  category: ProcurementCategory
  onMarkPaid: (eventDbIds: string[], categoryId: string, categoryName: string) => void
  onUnmarkPaid: (eventDbId: string, categoryId: string) => void
  markingPayment: boolean
}) {
  const [showIngredients, setShowIngredients] = useState(false)
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([])

  const unpaidEvents = category.events.filter(e => !e.isPaid)
  const paidEvents = category.events.filter(e => e.isPaid)
  const totalPaidAmount = paidEvents.reduce((sum, e) => sum + e.categoryCost, 0)
  const totalUnpaidAmount = unpaidEvents.reduce((sum, e) => sum + e.categoryCost, 0)

  const toggleEventSelection = (eventDbId: string) => {
    setSelectedEventIds(prev => 
      prev.includes(eventDbId) 
        ? prev.filter(id => id !== eventDbId)
        : [...prev, eventDbId]
    )
  }

  const selectAllUnpaid = () => {
    setSelectedEventIds(unpaidEvents.map(e => e.eventDbId))
  }

  const clearSelection = () => {
    setSelectedEventIds([])
  }

  const handleMarkPaid = () => {
    if (selectedEventIds.length === 0) return
    onMarkPaid(selectedEventIds, category.categoryId, category.categoryName)
    setSelectedEventIds([])
  }

  return (
    <div className="space-y-4">
      {/* Category Summary Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-muted/50 rounded-lg">
        <div>
          <h3 className="text-lg font-bold">{category.categoryName}</h3>
          <p className="text-sm text-muted-foreground">
            {category.ingredients.length} ingredients across {category.events.length} events
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-center">
            <p className="text-muted-foreground">Total Cost</p>
            <p className="text-lg font-bold text-primary">₹{category.totalCost.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">Paid</p>
            <p className="text-lg font-bold text-green-600">₹{totalPaidAmount.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">Unpaid</p>
            <p className="text-lg font-bold text-red-600">₹{totalUnpaidAmount.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Events List for this Category */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Events / इवेंट्स
          </h4>
          {unpaidEvents.length > 0 && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={selectAllUnpaid}>
                Select All Unpaid
              </Button>
              {selectedEventIds.length > 0 && (
                <>
                  <Button size="sm" variant="outline" onClick={clearSelection}>
                    <X className="w-3 h-3 mr-1" />Clear
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleMarkPaid}
                    disabled={markingPayment}
                  >
                    {markingPayment ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3 mr-1" />
                    )}
                    Mark {selectedEventIds.length} as Paid
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          {category.events.map((event) => (
            <div
              key={event.eventDbId}
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border transition-all",
                event.isPaid 
                  ? "bg-green-50/50 border-green-200" 
                  : selectedEventIds.includes(event.eventDbId)
                    ? "bg-primary/5 border-primary"
                    : "hover:bg-muted/30"
              )}
            >
              <div className="flex items-center gap-3">
                {!event.isPaid && (
                  <input
                    type="checkbox"
                    checked={selectedEventIds.includes(event.eventDbId)}
                    onChange={() => toggleEventSelection(event.eventDbId)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{event.eventId}</span>
                    <Badge variant={event.boughtBy === "caterer" ? "warning" : "secondary"}>
                      {event.boughtBy === "caterer" ? "Caterer Bought" : "Client Bought"}
                    </Badge>
                    {event.isPaid && (
                      <Badge variant="success">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Paid {event.paymentDate ? formatDate(event.paymentDate) : ""}
                      </Badge>
                    )}
                  </div>
                  <p className="font-medium mt-0.5">{event.organizerName}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(event.functionDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {event.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {event.guestCount} guests
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-lg font-bold">₹{event.categoryCost.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Category cost</p>
                </div>
                {event.isPaid && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => onUnmarkPaid(event.eventDbId, category.categoryId)}
                    disabled={markingPayment}
                  >
                    <Undo2 className="w-3 h-3 mr-1" />
                    Undo
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Aggregated Ingredients List */}
      <div>
        <button
          onClick={() => setShowIngredients(!showIngredients)}
          className="flex items-center gap-2 font-semibold text-sm hover:text-primary transition-colors w-full py-2"
        >
          <Package className="w-4 h-4" />
          Total Ingredients Summary / कुल सामग्री सारांश
          ({category.ingredients.length} items)
          {showIngredients ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
        </button>

        {showIngredients && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
                  <th className="p-3">Ingredient / सामग्री</th>
                  <th className="p-3 text-center">Total Qty</th>
                  <th className="p-3 text-center">Unit</th>
                  <th className="p-3 text-right">Total Cost</th>
                  <th className="p-3 text-center">Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {category.ingredients.map((ing) => (
                  <IngredientRow key={ing.ingredientId} ingredient={ing} />
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 font-bold">
                  <td className="p-3">Total</td>
                  <td className="p-3"></td>
                  <td className="p-3"></td>
                  <td className="p-3 text-right text-primary">₹{category.totalCost.toLocaleString()}</td>
                  <td className="p-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================
// INGREDIENT ROW WITH EXPANDABLE BREAKDOWN
// =============================================

function IngredientRow({ ingredient }: { ingredient: ProcurementIngredient }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr className="border-t hover:bg-muted/20 transition-colors">
        <td className="p-3 font-medium">{ingredient.name}</td>
        <td className="p-3 text-center font-semibold">{ingredient.totalQuantity}</td>
        <td className="p-3 text-center text-muted-foreground">{ingredient.unit}</td>
        <td className="p-3 text-right font-semibold">₹{ingredient.totalCost.toLocaleString()}</td>
        <td className="p-3 text-center">
          {ingredient.perEvent.length > 1 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-primary hover:underline flex items-center gap-1 mx-auto"
            >
              {ingredient.perEvent.length} events
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
          {ingredient.perEvent.length === 1 && (
            <span className="text-xs text-muted-foreground">1 event</span>
          )}
        </td>
      </tr>
      {expanded && ingredient.perEvent.map((pe, idx) => (
        <tr key={idx} className="bg-muted/10 text-xs">
          <td className="pl-8 py-2">
            <span className="text-muted-foreground">↳</span> {pe.organizerName}
            <span className="text-muted-foreground ml-1">({formatDate(pe.functionDate)})</span>
          </td>
          <td className="py-2 text-center">{pe.quantity}</td>
          <td className="py-2 text-center text-muted-foreground">{ingredient.unit}</td>
          <td className="py-2 text-right">
            ₹{pe.cost.toLocaleString()}
            <span className="text-muted-foreground ml-1">
              (@₹{pe.pricePerUnit}/{ingredient.unit})
            </span>
          </td>
          <td className="py-2 text-center">
            <span className="font-mono text-muted-foreground">{pe.eventId}</span>
          </td>
        </tr>
      ))}
    </>
  )
}

// =============================================
// MAIN PAGE COMPONENT
// =============================================

export default function BillingStatsPage() {
  const { toast } = useToast()
  const [chartView, setChartView] = useState<"weekly" | "monthly">("monthly")
  
  // Procurement state
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0])
  const [selectedPieCategory, setSelectedPieCategory] = useState<string | null>(null)
  const [categorySearch, setCategorySearch] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const [markingPayment, setMarkingPayment] = useState(false)

  // NEW: selected month for profit chart breakdown
  const [selectedProfitMonth, setSelectedProfitMonth] = useState<number | null>(null)

  // Fetch revenue stats
  const { data: stats, isLoading: loadingStats } = useSWRFetch<Stats>("/api/bills/stats", { revalidateOnFocus: true })

  // Fetch procurement data
  const procurementUrl = `/api/procurement?startDate=${startDate}&endDate=${endDate}`
  const { 
    data: procurement, 
    isLoading: loadingProcurement, 
    mutate: mutateProcurement 
  } = useSWRFetch<ProcurementData>(procurementUrl)

  const maxRevenue = useMemo(() => {
    if (!stats) return 0
    const data = chartView === "weekly" ? stats.weeklyData : stats.monthlyData
    return Math.max(...data.map(d => d.revenue), 1)
  }, [stats, chartView])

  // max for profit chart
  const maxProfitChartValue = useMemo(() => {
    if (!stats?.profitData) return 1
    return Math.max(...stats.profitData.map(d => Math.max(d.revenue, d.procurementCost, Math.abs(d.profit))), 1)
  }, [stats?.profitData])

  // Selected month's breakdown data
  const selectedMonthData = useMemo(() => {
    if (selectedProfitMonth === null || !stats?.profitData) return null
    return stats.profitData[selectedProfitMonth] || null
  }, [selectedProfitMonth, stats?.profitData])

  // Filter categories based on dropdown selection and pie selection
  const filteredCategories = useMemo(() => {
    if (!procurement) return []
    let cats = procurement.categories
    
    // Pie chart click overrides everything
    if (selectedPieCategory) {
      return cats.filter(c => c.categoryId === selectedPieCategory)
    }
    
    // Only show categories that are explicitly selected in dropdown
    if (selectedCategories.length === 0) return []
    
    cats = cats.filter(c => selectedCategories.includes(c.categoryId))
    
    return cats
  }, [procurement, selectedPieCategory, selectedCategories])

  // Categories available in dropdown (from procurement data, filtered by search)
  const dropdownCategories = useMemo(() => {
    if (!procurement) return []
    if (!categorySearch) return procurement.pieChartData
    const search = categorySearch.toLowerCase()
    return procurement.pieChartData.filter(c => c.categoryName.toLowerCase().includes(search))
  }, [procurement, categorySearch])

  // Toggle category selection
  const toggleCategory = (catId: string) => {
    setSelectedCategories(prev => 
      prev.includes(catId) 
        ? prev.filter(id => id !== catId) 
        : [...prev, catId]
    )
  }

  // Mark payment handler
  const handleMarkPaid = useCallback(async (
    eventDbIds: string[], 
    categoryId: string, 
    categoryName: string
  ) => {
    setMarkingPayment(true)
    try {
      const res = await fetch("/api/category-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventIds: eventDbIds,
          ingredientCategoryId: categoryId,
          categoryName
        })
      })
      const data = await res.json()
      if (data.success) {
        toast({ 
          title: "Payment Marked / भुगतान चिह्नित", 
          description: `${categoryName} marked as paid for ${eventDbIds.length} event(s)` 
        })
        mutateProcurement()
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to mark payment", 
        variant: "destructive" 
      })
    } finally {
      setMarkingPayment(false)
    }
  }, [toast, mutateProcurement])

  // Unmark payment handler
  const handleUnmarkPaid = useCallback(async (eventDbId: string, categoryId: string) => {
    if (!confirm("Are you sure you want to unmark this payment?")) return
    
    setMarkingPayment(true)
    try {
      const res = await fetch(
        `/api/category-payments?eventId=${eventDbId}&ingredientCategoryId=${categoryId}`,
        { method: "DELETE" }
      )
      const data = await res.json()
      if (data.success) {
        toast({ title: "Payment Unmarked", description: "Payment record removed" })
        mutateProcurement()
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to unmark payment", 
        variant: "destructive" 
      })
    } finally {
      setMarkingPayment(false)
    }
  }, [toast, mutateProcurement])

  if (loadingStats) return <Loading />
  if (!stats) return null

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2">
          <BarChart3 className="w-8 h-8 text-primary" />
          Revenue Analytics / राजस्व विश्लेषण
        </h1>
        <p className="text-muted-foreground mt-1">Track your billing, revenue & procurement costs</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-primary flex items-center">
                  <IndianRupee className="w-5 h-5" />
                  {stats.totalRevenue.toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Bills</p>
                <p className="text-2xl font-bold">{stats.billCount}</p>
              </div>
              <div className="p-3 bg-muted rounded-full">
                <Receipt className="w-6 h-6 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bills Paid</p>
                <p className="text-2xl font-bold text-green-600">{stats.statusCounts.paid}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bills Not Paid</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats.statusCounts.unpaid + stats.statusCounts.partial}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bill Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Bill Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-600">{stats.statusCounts.paid}</p>
              <p className="text-sm text-muted-foreground">Paid</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <Clock className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-orange-600">{stats.statusCounts.partial}</p>
              <p className="text-sm text-muted-foreground">Partial</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-600">{stats.statusCounts.unpaid}</p>
              <p className="text-sm text-muted-foreground">Unpaid</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Chart — gray=revenue, green=paid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Revenue Chart
            </CardTitle>
            <div className="flex gap-2">
              <button
                onClick={() => setChartView("weekly")}
                className={cn(
                  "px-3 py-1 text-sm rounded-md transition-colors",
                  chartView === "weekly" 
                    ? "bg-primary text-white" 
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                Weekly
              </button>
              <button
                onClick={() => setChartView("monthly")}
                className={cn(
                  "px-3 py-1 text-sm rounded-md transition-colors",
                  chartView === "monthly" 
                    ? "bg-primary text-white" 
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                Monthly
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2" style={{ height: "256px" }}>
            {(chartView === "weekly" ? stats.weeklyData : stats.monthlyData).map((item, idx) => {
              const barHeight = maxRevenue > 0 ? Math.max((item.revenue / maxRevenue) * 220, 4) : 4
              const paidHeight = item.revenue > 0 ? (item.paid / item.revenue) * barHeight : 0
              
              return (
                <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className="text-xs text-muted-foreground mb-1">
                    {item.revenue > 0 ? (item.revenue > 1000 ? `₹${(item.revenue / 1000).toFixed(0)}K` : `₹${item.revenue}`) : ""}
                  </span>
                  <div 
                    className="w-full relative rounded-t overflow-hidden"
                    style={{ height: `${barHeight}px` }}
                  >
                    {/* Gray bar = total revenue */}
                    <div className="absolute inset-0 bg-gray-300" />
                    {/* Green bar = paid portion */}
                    {paidHeight > 0 && (
                      <div 
                        className="absolute bottom-0 left-0 right-0 bg-green-500"
                        style={{ height: `${paidHeight}px` }}
                      />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">
                    {chartView === "weekly" ? (item as any).day : (item as any).month}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-300 rounded" />
              <span>Total Revenue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded" />
              <span>Paid</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profit Chart — clickable months with breakdown */}
      {stats.profitData && stats.profitData.some(d => d.revenue > 0 || d.procurementCost > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Profit Chart / लाभ चार्ट
              <span className="text-sm font-normal text-muted-foreground">(Click a month to see event breakdown)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1" style={{ height: "256px" }}>
              {stats.profitData.map((item, idx) => {
                const revenueHeight = maxProfitChartValue > 0 ? Math.max((item.revenue / maxProfitChartValue) * 200, 0) : 0
                const costHeight = maxProfitChartValue > 0 ? Math.max((item.procurementCost / maxProfitChartValue) * 200, 0) : 0
                const profitHeight = maxProfitChartValue > 0 ? Math.max((Math.max(item.profit, 0) / maxProfitChartValue) * 200, 0) : 0
                const hasData = item.revenue > 0 || item.procurementCost > 0
                const isSelected = selectedProfitMonth === idx

                return (
                  <div 
                    key={idx} 
                    className={cn(
                      "flex-1 flex flex-col items-center justify-end h-full cursor-pointer rounded-t transition-colors",
                      isSelected && "bg-primary/5",
                      hasData && "hover:bg-muted/30"
                    )}
                    onClick={() => hasData ? setSelectedProfitMonth(isSelected ? null : idx) : null}
                  >
                    {hasData && (
                      <div className="text-center mb-1">
                        <span className={cn("text-xs font-semibold", item.profit >= 0 ? "text-green-600" : "text-red-600")}>
                          {item.profit > 0 ? "+" : ""}₹{Math.abs(item.profit) > 1000 ? `${(item.profit / 1000).toFixed(0)}K` : item.profit.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div 
                      className="w-full flex gap-0.5 items-end justify-center" 
                      style={{ height: `${Math.max(revenueHeight, costHeight, profitHeight, hasData ? 4 : 0)}px` }}
                    >
                      <div className="w-[30%] bg-blue-400 rounded-t" style={{ height: `${Math.max(revenueHeight, hasData ? 4 : 0)}px` }} />
                      <div className="w-[30%] bg-orange-400 rounded-t" style={{ height: `${Math.max(costHeight, hasData ? 4 : 0)}px` }} />
                      <div className="w-[30%] bg-green-500 rounded-t" style={{ height: `${Math.max(profitHeight, item.profit > 0 ? 4 : 0)}px` }} />
                    </div>
                    <span className={cn("text-xs mt-1", isSelected ? "text-primary font-bold" : "text-muted-foreground")}>
                      {item.month}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-400 rounded" /><span>Bill Revenue</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-orange-400 rounded" /><span>Procurement Cost (Caterer)</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded" /><span>Profit</span></div>
            </div>

            {/* NEW: Monthly Event Breakdown Panel */}
            {selectedMonthData && selectedMonthData.eventBreakdown && selectedMonthData.eventBreakdown.length > 0 && (
              <div className="mt-6 border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {selectedMonthData.month} Breakdown / {selectedMonthData.month} विवरण
                    <Badge variant="secondary">{selectedMonthData.eventBreakdown.length} events</Badge>
                  </h4>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedProfitMonth(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
                        <th className="p-3">Event</th>
                        <th className="p-3 text-center">Date</th>
                        <th className="p-3">Meals</th>
                        <th className="p-3 text-right">Bill Amount</th>
                        <th className="p-3 text-right">Procurement</th>
                        <th className="p-3 text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedMonthData.eventBreakdown.map((ev) => (
                        <tr key={ev.eventId} className="border-t hover:bg-muted/20">
                          <td className="p-3">
                            <span className="font-mono text-xs text-muted-foreground">{ev.eventId}</span>
                            <p className="font-medium">{ev.organizerName}</p>
                          </td>
                          <td className="p-3 text-center text-sm">{formatDate(ev.functionDate)}</td>
                          <td className="p-3">
                            {ev.mealLabels && ev.mealLabels.length > 0 ? (
                              <div className="space-y-0.5">
                                {ev.mealLabels.map((m, i) => (
                                  <div key={i} className="text-xs capitalize">
                                    <span className="font-medium">{m.label}</span>
                                    <span className="text-muted-foreground ml-1">({m.guests}g × ₹{m.perPlate.toLocaleString()})</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">{ev.guestCount} guests</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-semibold text-blue-600">₹{ev.billAmount.toLocaleString()}</td>
                          <td className="p-3 text-right font-semibold text-orange-600">₹{ev.procurementCost.toLocaleString()}</td>
                          <td className={cn("p-3 text-right font-bold", ev.profit >= 0 ? "text-green-600" : "text-red-600")}>
                            {ev.profit >= 0 ? "+" : ""}₹{ev.profit.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30 font-bold border-t-2">
                        <td className="p-3" colSpan={3}>Monthly Total / मासिक कुल</td>
                        <td className="p-3 text-right text-blue-600">₹{selectedMonthData.revenue.toLocaleString()}</td>
                        <td className="p-3 text-right text-orange-600">₹{selectedMonthData.procurementCost.toLocaleString()}</td>
                        <td className={cn("p-3 text-right", selectedMonthData.profit >= 0 ? "text-green-600" : "text-red-600")}>
                          {selectedMonthData.profit >= 0 ? "+" : ""}₹{selectedMonthData.profit.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {selectedMonthData && (!selectedMonthData.eventBreakdown || selectedMonthData.eventBreakdown.length === 0) && (
              <div className="mt-6 border-t pt-4 text-center text-muted-foreground py-4">
                <p>No events found in {selectedMonthData.month}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ================================================== */}
      {/* PROCUREMENT BILLS TRACKER SECTION */}
      {/* ================================================== */}
      
      <div className="border-t-4 border-primary/20 pt-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-primary" />
            Procurement Bills / खरीदारी बिल
          </h2>
          <p className="text-muted-foreground mt-1">
            Track ingredient procurement costs by category across events and mark payments
          </p>
        </div>

        {/* Date Range Selector */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Start Date / शुरू</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-44"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">End Date / अंत</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-44"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const d = new Date()
                    d.setDate(d.getDate() - 7)
                    setStartDate(d.toISOString().split("T")[0])
                    setEndDate(new Date().toISOString().split("T")[0])
                  }}
                >
                  Last 7 Days
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const d = new Date()
                    d.setMonth(d.getMonth() - 1)
                    setStartDate(d.toISOString().split("T")[0])
                    setEndDate(new Date().toISOString().split("T")[0])
                  }}
                >
                  Last Month
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const d = new Date()
                    d.setMonth(d.getMonth() - 3)
                    setStartDate(d.toISOString().split("T")[0])
                    setEndDate(new Date().toISOString().split("T")[0])
                  }}
                >
                  Last 3 Months
                </Button>
              </div>
            </div>

            {/* Procurement Summary Cards */}
            {procurement && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Total Procurement</p>
                  <p className="text-xl font-bold text-primary">
                    ₹{procurement.summary.grandTotal.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <p className="text-xl font-bold text-green-600">
                    ₹{procurement.summary.totalPaid.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Unpaid</p>
                  <p className="text-xl font-bold text-red-600">
                    ₹{procurement.summary.totalUnpaid.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Events</p>
                  <p className="text-xl font-bold">{procurement.summary.totalEvents}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {loadingProcurement ? (
          <Loading className="min-h-[200px]" />
        ) : procurement && procurement.pieChartData.length > 0 ? (
          <>
            {/* Pie Chart - Category Cost Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Cost by Category / श्रेणी के अनुसार लागत
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PieChart
                  data={procurement.pieChartData}
                  selectedCategory={selectedPieCategory}
                  onSelect={setSelectedPieCategory}
                />
              </CardContent>
            </Card>

            {/* Category Selector + Details */}
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Category Details / श्रेणी विवरण
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {selectedPieCategory && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedPieCategory(null)}
                      >
                        <Filter className="w-3 h-3 mr-1" />
                        Clear Pie Filter
                      </Button>
                    )}
                    {selectedCategories.length > 0 && !selectedPieCategory && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedCategories([])}
                      >
                        <X className="w-3 h-3 mr-1" />
                        Clear All ({selectedCategories.length})
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Category Dropdown Selector */}
                {!selectedPieCategory && (
                  <div className="mb-6">
                    <div className="relative">
                      <button
                        onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                        className={cn(
                          "w-full flex items-center justify-between p-3 border rounded-lg transition-colors text-left",
                          categoryDropdownOpen ? "border-primary ring-1 ring-primary" : "hover:border-primary/50"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Search className="w-4 h-4 text-muted-foreground" />
                          {selectedCategories.length === 0 ? (
                            <span className="text-muted-foreground">Select categories to view details...</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {selectedCategories.map(catId => {
                                const cat = procurement?.pieChartData.find(c => c.categoryId === catId)
                                return cat ? (
                                  <span
                                    key={catId}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full"
                                  >
                                    {cat.categoryName}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleCategory(catId)
                                      }}
                                      className="hover:text-destructive"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ) : null
                              })}
                            </div>
                          )}
                        </div>
                        {categoryDropdownOpen ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                      </button>

                      {/* Dropdown Panel */}
                      {categoryDropdownOpen && (
                        <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-900 border rounded-lg shadow-lg max-h-72 overflow-hidden">
                          {/* Search inside dropdown */}
                          <div className="p-2 border-b">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                              <input
                                type="text"
                                placeholder="Search categories..."
                                value={categorySearch}
                                onChange={e => setCategorySearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary bg-transparent"
                                autoFocus
                              />
                            </div>
                            {/* Quick actions */}
                            <div className="flex items-center gap-2 mt-2">
                              <button
                                onClick={() => {
                                  if (procurement) {
                                    setSelectedCategories(procurement.pieChartData.map(c => c.categoryId))
                                  }
                                }}
                                className="text-xs text-primary hover:underline"
                              >
                                Select All
                              </button>
                              <span className="text-muted-foreground text-xs">|</span>
                              <button
                                onClick={() => setSelectedCategories([])}
                                className="text-xs text-muted-foreground hover:text-foreground"
                              >
                                Clear All
                              </button>
                            </div>
                          </div>

                          {/* Category options */}
                          <div className="overflow-y-auto max-h-52">
                            {dropdownCategories.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">No categories found</p>
                            ) : (
                              dropdownCategories.map((cat, idx) => {
                                const isSelected = selectedCategories.includes(cat.categoryId)
                                return (
                                  <button
                                    key={cat.categoryId}
                                    onClick={() => toggleCategory(cat.categoryId)}
                                    className={cn(
                                      "w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                                      isSelected ? "bg-primary/5" : "hover:bg-muted/50"
                                    )}
                                  >
                                    <div className={cn(
                                      "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                      isSelected ? "bg-primary border-primary" : "border-gray-300"
                                    )}>
                                      {isSelected && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <div
                                      className="w-3 h-3 rounded-full shrink-0"
                                      style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <span className="font-medium">{cat.categoryName}</span>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <span className="font-semibold">₹{cat.totalCost.toLocaleString()}</span>
                                      <span className="text-xs text-muted-foreground ml-1">
                                        ({cat.percentage.toFixed(1)}%)
                                      </span>
                                    </div>
                                  </button>
                                )
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Click outside to close */}
                    {categoryDropdownOpen && (
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => {
                          setCategoryDropdownOpen(false)
                          setCategorySearch("")
                        }} 
                      />
                    )}
                  </div>
                )}

                {/* Selected Category Details */}
                {filteredCategories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    {selectedPieCategory ? (
                      <p>No data for the selected category</p>
                    ) : selectedCategories.length === 0 ? (
                      <div>
                        <p className="text-lg font-medium">Select a category to view details</p>
                        <p className="text-sm mt-1">
                          Use the dropdown above or click a slice on the pie chart
                        </p>
                      </div>
                    ) : (
                      <p>No categories found for the selected filters</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-8">
                    {filteredCategories.map(cat => (
                      <CategoryDetail
                        key={cat.categoryId}
                        category={cat}
                        onMarkPaid={handleMarkPaid}
                        onUnmarkPaid={handleUnmarkPaid}
                        markingPayment={markingPayment}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : procurement ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <ShoppingCart className="w-16 h-16 mx-auto mb-3 opacity-20" />
              <p className="text-lg font-medium">No procurement data found</p>
              <p className="text-sm mt-1">
                No events with ingredients found between {formatDate(startDate)} and {formatDate(endDate)}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
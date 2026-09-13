"use client"

import { cn } from "@/lib/utils"
import type { PieChartItem } from "./types"

// CHANGED: lifted verbatim out of billing/stats/page.tsx. Pure CSS/SVG — no charting
// library — so it stays dependency-free and prints cleanly.

// Exported: the legend/list on the stats page colours its rows from the same palette.
export const PIE_COLORS = [
  "#4a7c59", "#e07a3a", "#3b82f6", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f59e0b", "#6366f1", "#84cc16",
  "#06b6d4", "#f43f5e", "#a855f7", "#22c55e", "#d97706",
  "#0ea5e9", "#e11d48", "#7c3aed", "#10b981", "#f97316",
  "#6d28d9", "#059669", "#dc2626", "#2563eb", "#ca8a04"
]

// =============================================
// PIE CHART COMPONENT (Pure CSS/SVG)

export function PieChart({ 
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
            ₹{total > 100000 ? `${(total / 1000).toFixed(0)}K` : total.toLocaleString("en-IN")}
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
                  ₹{slice.totalCost.toLocaleString("en-IN")} ({slice.percentage.toFixed(1)}%)
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

"use client"

import { useState, useMemo } from "react"
import { 
  TrendingUp, 
  IndianRupee, 
  Receipt, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  BarChart3,
  Calendar
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent, Loading } from "@/components/shared"
import { useSWRFetch } from "@/hooks/useSWRFetch"
import { cn } from "@/lib/utils"

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
}

export default function BillingStatsPage() {
  const [chartView, setChartView] = useState<"weekly" | "monthly">("monthly")
  
  const { data: stats, isLoading } = useSWRFetch<Stats>("/api/bills/stats")

  const maxRevenue = useMemo(() => {
    if (!stats) return 0
    const data = chartView === "weekly" ? stats.weeklyData : stats.monthlyData
    return Math.max(...data.map(d => d.revenue), 1)
  }, [stats, chartView])

  if (isLoading) return <Loading />

  if (!stats) return null

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2">
          <BarChart3 className="w-8 h-8 text-primary" />
          Revenue Analytics / राजस्व विश्लेषण
        </h1>
        <p className="text-muted-foreground mt-1">Track your billing and revenue</p>
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
                <p className="text-sm text-muted-foreground">Total Paid</p>
                <p className="text-2xl font-bold text-green-600 flex items-center">
                  <IndianRupee className="w-5 h-5" />
                  {stats.totalPaid.toLocaleString()}
                </p>
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
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-orange-600 flex items-center">
                  <IndianRupee className="w-5 h-5" />
                  {stats.totalPending.toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <Clock className="w-6 h-6 text-orange-600" />
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

      {/* Revenue Chart */}
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
          <div className="h-64 flex items-end gap-2">
            {(chartView === "weekly" ? stats.weeklyData : stats.monthlyData).map((item, idx) => {
              const heightPercent = (item.revenue / maxRevenue) * 100
              const paidPercent = item.revenue > 0 ? (item.paid / item.revenue) * 100 : 0
              
              return (
                <div key={idx} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex flex-col items-center mb-2">
                    <span className="text-xs text-muted-foreground mb-1">
                      ₹{item.revenue > 1000 ? `${(item.revenue / 1000).toFixed(0)}K` : item.revenue}
                    </span>
                    <div 
                      className="w-full bg-muted rounded-t relative overflow-hidden"
                      style={{ height: `${Math.max(heightPercent, 5)}%` }}
                    >
                      <div 
                        className="absolute bottom-0 left-0 right-0 bg-primary"
                        style={{ height: `${paidPercent}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {chartView === "weekly" ? item.day : item.month}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-muted rounded" />
              <span>Total Revenue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary rounded" />
              <span>Paid</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useState, useMemo } from "react"
import { Printer, Calendar, Package, Search, Building2, User, MapPin, Phone } from "lucide-react"
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"
import { Card, CardHeader, CardTitle, CardContent, Loading, Badge, EmptyState } from "@/components/shared"
import { useToast } from "@/hooks/useToast"
import { useSWRFetch } from "@/hooks/useSWRFetch"
import type { IngredientCategory } from "@/types"
import { formatDate } from "@/lib/utils"

interface PrintEvent {
  eventId: string
  organizerName: string
  phoneNumber: string
  location: string
  functionDate: string
  ingredients: { name: string; quantity: number; unit: string; notes?: string | null }[]
}

interface PrintData {
  category: string
  boughtBy: string
  dateRange: string
  events: PrintEvent[]
}

export default function CategoriesPrintPage() {
  const { toast } = useToast()
  
  const [selectedCategory, setSelectedCategory] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [boughtBy, setBoughtBy] = useState<'caterer' | 'client' | 'all'>('all')
  const [loading, setLoading] = useState(false)
  const [printData, setPrintData] = useState<PrintData | null>(null)
  
  const { data: ingredientCategories = [] } = useSWRFetch<IngredientCategory[]>('/api/categories/ingredients')

  const handleSubmit = async () => {
    if (!selectedCategory || !startDate || !endDate) {
      toast({ title: "Error", description: "Please select category and date range", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({
        categoryId: selectedCategory,
        startDate,
        endDate,
        ...(boughtBy !== 'all' && { boughtBy })
      })
      
      const res = await fetch(`/api/categories-print?${params}`)
      const data = await res.json()
      
      if (data.success) {
        const categoryName = ingredientCategories.find(c => c.id === selectedCategory)?.name || 'Unknown'
        setPrintData({
          category: categoryName,
          boughtBy: boughtBy === 'all' ? 'All' : boughtBy === 'caterer' ? 'Caterer' : 'Client',
          dateRange: `${formatDate(startDate)} - ${formatDate(endDate)}`,
          events: data.data
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => window.print()

  const totalIngredients = useMemo(() => {
    if (!printData) return {}
    const totals: Record<string, { quantity: number; unit: string }> = {}
    printData.events.forEach(event => {
      event.ingredients.forEach(ing => {
        if (!totals[ing.name]) totals[ing.name] = { quantity: 0, unit: ing.unit }
        totals[ing.name].quantity += ing.quantity
      })
    })
    return totals
  }, [printData])

  return (
    <>
      {/* Print Styles — edge-to-edge, no browser margins */}
      <style>{`
        @media print {
          @page { margin: 0 !important; size: auto; }
          html, body, main, #__next, [data-nextjs-scroll-focus-boundary] {
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
            margin: 0 !important; padding: 0 !important;
            width: 100% !important; max-width: 100% !important;
          }
          * { box-sizing: border-box; }
          nav, header, footer, aside, .no-print,
          [class*="sidebar"], [class*="navbar"], [class*="header"] {
            display: none !important;
          }
        }
      `}</style>

      <div className="max-w-5xl mx-auto animate-in print:max-w-none print:m-0 print:p-0">

        {/* ========== SCREEN ONLY: Page Header ========== */}
        <div className="mb-8 no-print">
          <h1 className="flex items-center gap-2">
            <Printer className="w-8 h-8 text-primary" />
            Categories Print / श्रेणी प्रिंट
          </h1>
          <p className="text-muted-foreground mt-1">
            Print ingredient requirements by category for multiple events
          </p>
        </div>

        {/* ========== SCREEN ONLY: Filter Card ========== */}
        <Card className="mb-6 no-print">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Filter Options
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="label mb-1.5 block">Category *</label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {ingredientCategories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="label mb-1.5 block">Start Date *</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="label mb-1.5 block">End Date *</label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
              <div>
                <label className="label mb-1.5 block">Bought By</label>
                <Select value={boughtBy} onValueChange={(v: any) => setBoughtBy(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="caterer">Caterer</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={handleSubmit} loading={loading}>
                <Search className="w-4 h-4 mr-2" />
                Generate Report
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ========== Content ========== */}
        {loading ? (
          <Loading text="Generating report..." />
        ) : printData ? (
          <div>
            {/* Print button (screen only) */}
            <div className="flex justify-end mb-4 no-print">
              <Button onClick={handlePrint}><Printer className="w-4 h-4 mr-2" />Print</Button>
            </div>

            {/* Print Header — centered, same as original */}
            <div className="print-only mb-4 text-center">
              <h1 className="text-xl font-bold">Anchal Caterers</h1>
              <p className="text-base">{printData.category} - Ingredient List</p>
              <p className="text-xs text-muted-foreground">{printData.dateRange} | {printData.boughtBy}</p>
            </div>

            {/* Total Summary — SCREEN ONLY (hidden in print) */}
            <Card className="mb-4 no-print">
              <CardHeader>
                <CardTitle>Total Requirements / कुल आवश्यकता</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(totalIngredients).map(([name, data]) => (
                    <div key={name} className="p-2 bg-primary/5 rounded border">
                      <p className="font-semibold">{name}</p>
                      <p className="text-sm">{data.quantity} {data.unit}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Events List */}
            {printData.events.length === 0 ? (
              <EmptyState icon={Package} title="No events found" description="No events match the selected criteria" />
            ) : (
              <>
                {/* ---- SCREEN version (unchanged from original) ---- */}
                <div className="space-y-3 print:hidden">
                  {printData.events.map((event, idx) => (
                    <Card key={event.eventId}>
                      <CardContent className="pt-3">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="primary">{idx + 1}</Badge>
                              <span className="font-mono text-sm">{event.eventId}</span>
                            </div>
                            <h3 className="font-bold text-base">{event.organizerName}</h3>
                          </div>
                          <div className="text-right text-sm">
                            <div className="flex items-center gap-1 justify-end">
                              <Calendar className="w-3 h-3" />
                              {formatDate(event.functionDate)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-2">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />{event.phoneNumber}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{event.location}
                          </span>
                        </div>

                        <div className="border-t pt-2">
                          <div className="flex flex-wrap gap-1">
                            {event.ingredients.map(ing => (
                              <span key={ing.name} className="px-2 py-0.5 bg-muted rounded text-xs">
                                {ing.name}: <strong>{ing.quantity} {ing.unit}</strong>
                                {ing.notes && <span className="text-amber-700 ml-1">({ing.notes})</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* ---- PRINT version — compact bordered cards ---- */}
                <div className="hidden print:block" style={{ padding: "0 6px" }}>
                  {printData.events.map((event, idx) => (
                    <div
                      key={event.eventId}
                      style={{
                        border: "1px solid #d1d5db",
                        borderRadius: "4px",
                        marginBottom: "4px",
                        padding: "4px 6px",
                        pageBreakInside: "avoid",
                        breakInside: "avoid"
                      }}
                    >
                      {/* Row 1: Name (left) + Date (right) */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontWeight: 700, fontSize: "20px" }}>
                          {idx + 1}. {event.organizerName}
                        </span>
                        <span style={{ fontSize: "15px", color: "#6b7280", whiteSpace: "nowrap" }}>
                          📅 {formatDate(event.functionDate)}
                        </span>
                      </div>

                      {/* Row 2: Phone + Location */}
                      <div style={{ fontSize: "15px", color: "#6b7280", marginTop: "1px" }}>
                        📞 {event.phoneNumber} &nbsp; 📍 {event.location}
                      </div>

                      {/* Separator line */}
                      <div style={{ borderTop: "1px solid #e5e7eb", marginTop: "3px", paddingTop: "2px" }}>
                        {/* Ingredients */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          {event.ingredients.map(ing => (
                            <span
                              key={ing.name}
                              style={{
                                fontSize: "15px",
                                padding: "0 4px",
                                backgroundColor: "#f3f4f6",
                                borderRadius: "2px",
                                lineHeight: "1.5"
                              }}
                            >
                              {ing.name}: <strong>{ing.quantity} {ing.unit}</strong>
                              {ing.notes && (
                                <span style={{ color: "#b45309", marginLeft: "2px" }}>({ing.notes})</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <EmptyState icon={Printer} title="Select filters above" description="Choose category and date range to generate report" />
        )}
      </div>
    </>
  )
}
"use client"

import { useState, useMemo } from "react"
import { Printer, Calendar, FileDown, Package, Search,FileSpreadsheet, MapPin, Phone } from "lucide-react" // CHANGED: - unused Building2, User
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"
import { Card, CardHeader, CardTitle, CardContent, Loading, Badge, EmptyState } from "@/components/shared"
import { useToast } from "@/hooks/useToast"
import { useSWRFetch } from "@/hooks/useSWRFetch"
import type { IngredientCategory } from "@/types"
import { formatDate, errorMessage, noteLines } from "@/lib/utils" // CHANGED: + noteLines

interface PrintEvent {
  eventId: string
  organizerName: string
  phoneNumber: string
  location: string
  homeAddress?: string | null // CHANGED: printed in the details line, like Word/Excel
  functionDate: string
  categoryNote?: string | null // CHANGED: this event's note for the category
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
    } catch (error) {
      toast({ title: "Error", description: errorMessage(error), variant: "destructive" })
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
                <Select value={boughtBy} onValueChange={(v) => setBoughtBy(v as 'caterer' | 'client' | 'all')}>
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
              {printData && (
                <Button variant="outline" onClick={() => {
                  const params = new URLSearchParams({
                    categoryId: selectedCategory,
                    startDate,
                    endDate,
                    ...(boughtBy !== 'all' && { boughtBy })
                  })
                  window.open(`/api/export/categories-docx?${params}`)
                }}>
                  <FileDown className="w-4 h-4 mr-2" />Word
                </Button>
              )}
              {printData && (
    <Button variant="outline" onClick={() => {
      const params = new URLSearchParams({
        categoryId: selectedCategory,
        startDate,
        endDate,
        ...(boughtBy !== 'all' && { boughtBy })
      })
      window.open(`/api/export/categories-xlsx?${params}`)
    }}>
      <FileSpreadsheet className="w-4 h-4 mr-2" />Excel
    </Button>
  )}
            </div>

            {/* CHANGED: Print header styled like the Event History print header (20px bold
                title, 12px black details line, 2px black rule under it) */}
            <div className="print-only border-b-2 border-black" style={{ lineHeight: 1.2, marginBottom: "2px", paddingBottom: "2px" }}>
              <h1 className="text-xl font-bold" style={{ margin: "10px 16px" }}>
                Anchal Caterers — {printData.category} - Ingredient List
              </h1>
              <div className="text-xs text-black" style={{ margin: "2px 16px" }}>
                {printData.dateRange} | {printData.boughtBy}
              </div>
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
                            {/* CHANGED: each line of the category note is its own amber pill after the ingredients */}
                            {noteLines(event.categoryNote).map((line, i) => (
                              <span key={`note-${i}`} className="px-2 py-0.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                                {line}
                              </span>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* ---- PRINT version ----
                    CHANGED: laid out like the Event History print (its "Ingredients" section):
                    per event a 14px bold heading with a thin grey underline, a 12px black
                    details line, then ONE 4-column grid filled top-to-bottom with a black
                    outline. Each line of the category note is one more cell at the END of
                    that grid, in amber, so notes sit inside the grid instead of a block below. */}
                <div className="hidden print:block" style={{ padding: "0 6px" }}>
                  {printData.events.map((event, idx) => {
                    const ings = [...event.ingredients].sort((a, b) => a.name.localeCompare(b.name))
                    const notes = noteLines(event.categoryNote)
                    const cellCount = ings.length + notes.length
                    const cell = {
                      breakInside: "avoid" as const, pageBreakInside: "avoid" as const,
                      fontSize: "12px", padding: "1px 4px",
                      borderRight: "1px solid black", borderBottom: "1px solid black", minWidth: 0
                    }
                    return (
                      <div key={event.eventId} style={{ marginTop: "6px", breakInside: "avoid", pageBreakInside: "avoid" }}>
                        <h2 style={{
                          fontSize: "14px", fontWeight: 700, marginLeft: "20px", marginBottom: "1px",
                          borderBottom: "1px solid #d1d5db", paddingBottom: "1px"
                        }}>
                          {idx + 1}. {event.organizerName}
                        </h2>
                        <div className="text-xs text-black" style={{ margin: "0 16px 2px", lineHeight: 1.2 }}>
                          {[
                            formatDate(event.functionDate),
                            event.location ? `Venue: ${event.location}` : "",
                            event.homeAddress ? `Home: ${event.homeAddress}` : "",
                            event.phoneNumber
                          ].filter(Boolean).join("  |  ")}
                        </div>
                        <div style={{
                          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gridAutoFlow: "column",
                          gridTemplateRows: `repeat(${Math.ceil(cellCount / 4)}, auto)`,
                          gap: "2px 0px", border: "1px solid black", borderRadius: "4px",
                          overflow: "hidden", margin: "0 16px"
                        }}>
                          {ings.map(ing => (
                            <div key={ing.name} style={{
                              ...cell, display: "flex", justifyContent: "space-between", alignItems: "center", gap: "2px"
                            }}>
                              <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                                {ing.name}
                                {ing.notes && (
                                  <span style={{ color: "#b45309", fontSize: "10px" }}> ({ing.notes})</span>
                                )}
                              </span>
                              <span style={{ fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
                                {ing.quantity} {ing.unit}
                              </span>
                            </div>
                          ))}
                          {notes.map((line, i) => (
                            <div key={`note-${i}`} style={{ ...cell, color: "#b45309", overflowWrap: "anywhere" }}>
                              {line}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
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
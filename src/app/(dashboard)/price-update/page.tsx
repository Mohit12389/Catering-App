"use client"

// =============================================
// PRICE UPDATE PAGE (date range → many prices at once)
// =============================================
// CHANGED: new page. Pick a date range → see which events it touches (left) and
// every ingredient those events use (table) → type new prices → ONE Save.
// Rules live in /api/ingredients/price-range (same as Inventory's Update Prices).

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import { IndianRupee, Calendar, Save } from "lucide-react"
import { Button, Input } from "@/components/ui"
import { Card, EmptyState, Loading, SearchInput, useConfirm } from "@/components/shared"
import { useToast } from "@/hooks/useToast"
import { useSWRFetch } from "@/hooks/useSWRFetch"
import { api } from "@/lib/apiClient"
import { cn, errorMessage, formatDate, todayLocalDate } from "@/lib/utils"
import type { PriceRangeEvent, PriceRangeIngredient } from "@/types"

const rupees = (n: number) => `₹${Number(n.toFixed(2))}`

export default function PriceUpdatePage() {
  const { toast } = useToast()
  const confirm = useConfirm()

  // Default: today onwards — the upcoming events are the ones still being priced.
  const [startDate, setStartDate] = useState(todayLocalDate())
  const [endDate, setEndDate] = useState("")
  const [search, setSearch] = useState("")
  const [newPrices, setNewPrices] = useState<Record<string, string>>({})
  const [setMaster, setSetMaster] = useState(false)
  const [saving, setSaving] = useState(false)

  const url = startDate || endDate
    ? `/api/ingredients/price-range?startDate=${startDate}&endDate=${endDate}`
    : null
  const { data, isLoading, mutate } = useSWRFetch<{ events: PriceRangeEvent[]; ingredients: PriceRangeIngredient[] }>(url)
  const events = useMemo(() => data?.events ?? [], [data])
  const ingredients = useMemo(() => data?.ingredients ?? [], [data])

  // A different range is a different list — typed prices would land on other events.
  useEffect(() => { setNewPrices({}) }, [startDate, endDate])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? ingredients.filter(i => i.name.toLowerCase().includes(q) || i.categoryName.toLowerCase().includes(q)) : ingredients
  }, [ingredients, search])

  // Changed = a valid number that differs from what the events use now. When the
  // events disagree any number counts (it makes them equal); with the default box
  // ticked, a number that differs from the default counts too.
  const changes = useMemo(() => ingredients.flatMap(i => {
    const raw = newPrices[i.id]
    if (raw === undefined || raw.trim() === "") return []
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return []
    const differs = i.minPrice !== i.maxPrice || n !== i.minPrice || (setMaster && n !== i.masterPrice)
    return differs ? [{ ingredientId: i.id, newPrice: n }] : []
  }), [ingredients, newPrices, setMaster])
  const changedIds = useMemo(() => new Set(changes.map(c => c.ingredientId)), [changes])

  // Enter jumps to the next price box, like moving down a spreadsheet column.
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const focusRow = (idx: number) => {
    const el = inputRefs.current[idx]
    if (el) { el.focus(); el.select() }
  }

  const handleSave = useCallback(async () => {
    if (changes.length === 0) return
    const rangeText = startDate && endDate ? `${startDate} to ${endDate}` : startDate ? `${startDate} onwards` : `up to ${endDate}`
    const ok = await confirm({
      title: `Update ${changes.length} price${changes.length === 1 ? "" : "s"}?`,
      description: `${events.length} active event${events.length === 1 ? "" : "s"} (${rangeText}) will use the new prices.` +
        (setMaster ? " The default price for new events will change too; other existing events keep their old price." : " Default price stays the same."),
      confirmText: "Update / अपडेट करें",
      variant: "default"
    })
    if (!ok) return
    setSaving(true)
    try {
      const result = await api.postRaw("/api/ingredients/price-range", { startDate, endDate, changes, setMaster })
      toast({ title: "Prices updated", description: result.message })
      setNewPrices({})
      await mutate()
    } catch (error) {
      toast({ title: "Error", description: errorMessage(error) || "Could not update prices", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }, [changes, startDate, endDate, events.length, setMaster, confirm, toast, mutate])

  let lastCategory = ""

  return (
    <div className="space-y-6 animate-in pb-24">
      <div>
        <h1>Price Update / मूल्य अपडेट</h1>
        <p className="text-muted-foreground mt-1">
          Change ingredient prices for all events in a date range at once
          <br />
          <span className="text-xs">तिथि सीमा के सभी इवेंट के लिए सामग्री के मूल्य एक साथ बदलें</span>
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label mb-1.5 flex items-center gap-1.5"><Calendar className="w-4 h-4" />From / से</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label mb-1.5 block">To / तक</label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground pb-2">
            Active events with their event date or any meal date in this range. Leave one side empty for an open range.
          </p>
        </div>
      </Card>

      {!url ? (
        <EmptyState icon={Calendar} title="Pick a date range" description="तिथि सीमा चुनें" />
      ) : isLoading && !data ? (
        <Loading />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr] items-start">
          {/* Affected events */}
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/40 text-sm font-semibold">
              Affected events / प्रभावित इवेंट ({events.length})
            </div>
            {events.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">No active events in this range</p>
            ) : (
              <ul className="max-h-[60vh] overflow-y-auto divide-y text-sm">
                {events.map(e => (
                  <li key={e.id} className="px-4 py-2">
                    <div className="text-xs text-muted-foreground">{formatDate(e.functionDate)}</div>
                    <Link href={`/event-history/${e.id}`} className="font-medium hover:underline">{e.organizerName}</Link>
                    <div className="text-xs text-muted-foreground truncate" title={e.location}>{e.location}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Ingredients */}
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/40 flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold">Ingredients / सामग्री ({ingredients.length})</span>
              <SearchInput compact value={search} onChange={setSearch} placeholder="Search... / खोजें..." wrapperClassName="w-56 ml-auto" />
            </div>
            {ingredients.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">No ingredients in these events</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="text-left font-medium px-4 py-2">Ingredient / सामग्री</th>
                      <th className="text-right font-medium px-3 py-2">Old price / पुराना</th>
                      <th className="text-left font-medium px-3 py-2 w-40">New price / नया (₹)</th>
                      <th className="text-right font-medium px-4 py-2">Events</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((ing, idx) => {
                      const header = ing.categoryName !== lastCategory
                      lastCategory = ing.categoryName
                      const same = ing.minPrice === ing.maxPrice
                      return [
                        header && (
                          <tr key={`cat-${ing.categoryName}`} className="bg-muted/30">
                            <td colSpan={4} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{ing.categoryName}</td>
                          </tr>
                        ),
                        <tr key={ing.id} className={cn("border-b last:border-b-0", changedIds.has(ing.id) && "bg-amber-50")}>
                          <td className="px-4 py-1.5">
                            <span className="font-medium">{ing.name}</span>
                            <span className="text-xs text-muted-foreground ml-1.5">/{ing.unit}</span>
                          </td>
                          <td className="px-3 py-1.5 text-right whitespace-nowrap">
                            {same ? rupees(ing.minPrice) : <span className="text-amber-700" title="Events in this range use different prices">{rupees(ing.minPrice)}–{rupees(ing.maxPrice)}</span>}
                            {(!same || ing.masterPrice !== ing.minPrice) && (
                              <div className="text-[11px] text-muted-foreground">default {rupees(ing.masterPrice)}</div>
                            )}
                          </td>
                          <td className="px-3 py-1">
                            <input
                              ref={el => { inputRefs.current[idx] = el }}
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="any"
                              className="input h-8 w-full text-right"
                              placeholder={same ? String(Number(ing.minPrice.toFixed(2))) : ""}
                              value={newPrices[ing.id] ?? ""}
                              onChange={e => setNewPrices(p => ({ ...p, [ing.id]: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); focusRow(idx + 1) }
                                else if (e.key === "ArrowUp") { e.preventDefault(); focusRow(idx - 1) }
                              }}
                              onWheel={e => e.currentTarget.blur()} // scrolling the page must not change a price
                            />
                          </td>
                          <td className="px-4 py-1.5 text-right text-muted-foreground">{ing.eventCount}</td>
                        </tr>
                      ]
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Save bar, fixed to the bottom so it's reachable from anywhere in a long list */}
      {url && ingredients.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 border-t bg-background/95 backdrop-blur print:hidden">
          <div className="container flex flex-wrap items-center gap-4 py-3">
            <span className="text-sm font-medium flex items-center gap-1.5">
              <IndianRupee className="w-4 h-4 text-amber-600" />
              {changes.length} price{changes.length === 1 ? "" : "s"} changed
            </span>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={setMaster} onChange={e => setSetMaster(e.target.checked)} className="w-4 h-4" />
              Also set as default price for new events / नए इवेंट के लिए भी
            </label>
            <div className="ml-auto flex gap-2">
              {changes.length > 0 && (
                <Button variant="outline" onClick={() => setNewPrices({})} disabled={saving}>Clear</Button>
              )}
              <Button onClick={handleSave} loading={saving} disabled={changes.length === 0 || events.length === 0}>
                <Save className="w-4 h-4 mr-2" />Save / सहेजें
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

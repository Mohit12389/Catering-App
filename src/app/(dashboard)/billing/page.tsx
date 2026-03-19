"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { 
  FileText, Plus, Search, Phone, Trash2, Printer, Check, X, IndianRupee,
  Calendar, User, MapPin, Percent, Receipt, TrendingUp, Clock, CheckCircle,
  AlertCircle, Package, Users, Banknote
} from "lucide-react"
import { Button, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/Dialog"
import { Card, CardHeader, CardTitle, CardContent, Loading, Badge, EmptyState } from "@/components/shared"
import { useToast } from "@/hooks/useToast"
import { useSWRFetch } from "@/hooks/useSWRFetch"
import { formatDate, cn } from "@/lib/utils"

interface BillItem {
  id?: string
  description: string
  quantity: number
  rate: number
  amount: number
  eventId?: string
}

interface Bill {
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
  paidAmount: number
  status: string
  notes?: string
  items: BillItem[]
  advanceTotal?: number
}

interface AdvancePaymentDetail {
  id: string
  amount: number
  paidDate: string
  notes?: string | null
}

interface MealGroupForBill {
  label: string
  date: string | null
  guests: number
  perPlate: number
}

interface EventForBill {
  id: string
  eventId: string
  organizerName: string
  functionDate: string
  functionTime: string
  guestCount: number
  perPlatePrice: number
  totalAmount: number
  advancePayment: number
  status: string
  catererCost?: number
  clientCost?: number
  advancePayments?: AdvancePaymentDetail[]
  mealGroups?: MealGroupForBill[]
}

export default function BillingPage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<"create" | "history">("create")
  const [organizationName, setOrganizationName] = useState("Your Business")
  
  const [customerName, setCustomerName] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [address, setAddress] = useState("")
  const [clientGstNo, setClientGstNo] = useState("")
  const [items, setItems] = useState<BillItem[]>([{ description: "", quantity: 1, rate: 0, amount: 0 }])
  const [discountType, setDiscountType] = useState<string>("")
  const [discountValue, setDiscountValue] = useState("")
  const [sgst, setSgst] = useState("0")
  const [cgst, setCgst] = useState("0")
  const [notes, setNotes] = useState("")
  const [creating, setCreating] = useState(false)
  const [editingBill, setEditingBill] = useState<Bill | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [customerEvents, setCustomerEvents] = useState<EventForBill[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchPhone, setSearchPhone] = useState("")
  
  const { data: bills = [], isLoading: loadingBills, mutate: mutateBills } = useSWRFetch<Bill[]>(
    `/api/bills?status=${statusFilter}${searchPhone ? `&phoneNumber=${searchPhone}` : ""}`
  )

  useEffect(() => {
    const fetchOrg = async () => {
      try { const res = await fetch("/api/user/organization"); const data = await res.json(); if (data.success && data.data.organizationName) setOrganizationName(data.data.organizationName) } catch {}
    }
    fetchOrg()
  }, [])

  const searchEventsByPhone = async () => {
    if (!phoneNumber || phoneNumber.length < 10) return
    setLoadingEvents(true)
    try { const res = await fetch(`/api/bills/events-by-phone?phoneNumber=${phoneNumber}`); const data = await res.json(); if (data.success) setCustomerEvents(data.data) }
    catch { console.error("Failed to fetch events") }
    finally { setLoadingEvents(false) }
  }

  useEffect(() => {
    if (phoneNumber.length >= 10) { const timer = setTimeout(searchEventsByPhone, 500); return () => clearTimeout(timer) }
    else { setCustomerEvents([]); setSelectedEventIds([]) }
  }, [phoneNumber])

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + (item.quantity * item.rate), 0), [items])
  const discountAmount = useMemo(() => {
    if (!discountType || !discountValue) return 0
    return discountType === "percentage" ? (subtotal * parseFloat(discountValue)) / 100 : parseFloat(discountValue) || 0
  }, [subtotal, discountType, discountValue])
  const afterDiscount = subtotal - discountAmount
  const sgstAmount = useMemo(() => (afterDiscount * parseFloat(sgst || "0")) / 100, [afterDiscount, sgst])
  const cgstAmount = useMemo(() => (afterDiscount * parseFloat(cgst || "0")) / 100, [afterDiscount, cgst])
  const totalAmount = afterDiscount + sgstAmount + cgstAmount

  const totalAdvanceForSelected = useMemo(() => customerEvents.filter(e => selectedEventIds.includes(e.id)).reduce((sum, e) => sum + (e.advancePayment || 0), 0), [customerEvents, selectedEventIds])

  const selectedEventsAdvanceDetails = useMemo(() => customerEvents.filter(e => selectedEventIds.includes(e.id) && (e.advancePayments?.length || 0) > 0).map(e => ({ eventId: e.eventId, functionDate: e.functionDate, functionTime: e.functionTime, advancePayment: e.advancePayment, advancePayments: e.advancePayments || [] })), [customerEvents, selectedEventIds])

  const addItem = () => setItems([...items, { description: "", quantity: 1, rate: 0, amount: 0 }])
  const updateItem = (index: number, field: keyof BillItem, value: string | number) => {
    const newItems = [...items]; newItems[index] = { ...newItems[index], [field]: value }
    if (field === "quantity" || field === "rate") newItems[index].amount = newItems[index].quantity * newItems[index].rate
    setItems(newItems)
  }
  const removeItem = (index: number) => { if (items.length > 1) setItems(items.filter((_, i) => i !== index)) }

  // UPDATED: Creates one bill row per meal label
  const addEventToBill = (event: EventForBill) => {
    const meals = event.mealGroups || []
    
    let newItems: BillItem[]
    
    if (meals.length > 0) {
      newItems = meals.map(meal => ({
        description: `${meal.label} - ${meal.date ? formatDate(meal.date) : formatDate(event.functionDate)} (${meal.guests} guests)`,
        quantity: meal.guests,
        rate: meal.perPlate,
        amount: meal.guests * meal.perPlate,
        eventId: event.id
      }))
    } else {
      newItems = [{
        description: `${event.functionTime} - ${formatDate(event.functionDate)} (${event.guestCount} guests)`,
        quantity: event.guestCount,
        rate: event.perPlatePrice,
        amount: event.totalAmount,
        eventId: event.id
      }]
    }
    
    setItems([...items.filter(i => i.description), ...newItems])
    if (!customerName) setCustomerName(event.organizerName)
    setSelectedEventIds(prev => prev.includes(event.id) ? prev : [...prev, event.id])
  }

  const handleCreateBill = async () => {
    if (!customerName || !phoneNumber) { toast({ title: "Error", description: "Customer name and phone required", variant: "destructive" }); return }
    const validItems = items.filter(i => i.description && i.rate > 0)
    if (validItems.length === 0) { toast({ title: "Error", description: "Add at least one item", variant: "destructive" }); return }
    setCreating(true)
    try {
      const res = await fetch("/api/bills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerName, phoneNumber, address, clientGstNo, items: validItems, discountType: discountType || null, discountValue: parseFloat(discountValue) || 0, sgst: parseFloat(sgst) || 0, cgst: parseFloat(cgst) || 0, notes }) })
      const data = await res.json()
      if (data.success) { toast({ title: "Success", description: `Bill ${data.data.billNumber} created!` }); setCustomerName(""); setPhoneNumber(""); setAddress(""); setClientGstNo(""); setItems([{ description: "", quantity: 1, rate: 0, amount: 0 }]); setDiscountType(""); setDiscountValue(""); setSgst("0"); setCgst("0"); setNotes(""); setCustomerEvents([]); setSelectedEventIds([]); mutateBills(); setActiveTab("history") }
      else throw new Error(data.error)
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }) }
    finally { setCreating(false) }
  }

  const updateBillStatus = async (billId: string, status: string) => {
    try { const res = await fetch(`/api/bills/${billId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); if ((await res.json()).success) { mutateBills(); toast({ title: "Success", description: "Status updated" }) } }
    catch { toast({ title: "Error", description: "Failed", variant: "destructive" }) }
  }

  const markAsPaid = async (billId: string, totalAmount: number) => {
    try { const res = await fetch(`/api/bills/${billId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paidAmount: totalAmount }) }); if ((await res.json()).success) { mutateBills(); toast({ title: "Success", description: "Marked as paid" }) } }
    catch { toast({ title: "Error", description: "Failed", variant: "destructive" }) }
  }

  const deleteBill = async (billId: string) => {
    if (!confirm("Delete this bill?")) return
    setDeleting(billId)
    try { const res = await fetch(`/api/bills/${billId}`, { method: "DELETE" }); if ((await res.json()).success) { mutateBills(); toast({ title: "Success", description: "Bill deleted" }) } }
    catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }) }
    finally { setDeleting(null) }
  }

  const startEditBill = (bill: Bill) => {
    setEditingBill(bill); setCustomerName(bill.customerName); setPhoneNumber(bill.phoneNumber); setAddress(bill.address || ""); setClientGstNo(bill.clientGstNo || "")
    setItems(bill.items.map(i => ({ id: i.id, description: i.description, quantity: i.quantity, rate: i.rate, amount: i.amount, eventId: i.eventId })))
    setDiscountType(bill.discountType || ""); setDiscountValue(bill.discountValue?.toString() || ""); setSgst(bill.sgst?.toString() || "0"); setCgst(bill.cgst?.toString() || "0"); setNotes(bill.notes || ""); setActiveTab("create")
  }

  const cancelEdit = () => {
    setEditingBill(null); setCustomerName(""); setPhoneNumber(""); setAddress(""); setClientGstNo("")
    setItems([{ description: "", quantity: 1, rate: 0, amount: 0 }]); setDiscountType(""); setDiscountValue(""); setSgst("0"); setCgst("0"); setNotes(""); setCustomerEvents([]); setSelectedEventIds([])
  }

  const handleUpdateBill = async () => {
    if (!editingBill || !customerName || !phoneNumber) { toast({ title: "Error", description: "Required fields missing", variant: "destructive" }); return }
    const validItems = items.filter(i => i.description && i.rate > 0)
    if (validItems.length === 0) { toast({ title: "Error", description: "Add at least one item", variant: "destructive" }); return }
    setCreating(true)
    try {
      const res = await fetch(`/api/bills/${editingBill.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerName, phoneNumber, address, clientGstNo, items: validItems, discountType: discountType || null, discountValue: parseFloat(discountValue) || 0, sgst: parseFloat(sgst) || 0, cgst: parseFloat(cgst) || 0, notes, updateItems: true }) })
      const data = await res.json()
      if (data.success) { toast({ title: "Success", description: `Bill updated!` }); cancelEdit(); mutateBills(); setActiveTab("history") }
      else throw new Error(data.error)
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }) }
    finally { setCreating(false) }
  }

  const printBill = (bill: Bill) => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return
    const html = `<!DOCTYPE html><html><head><title>Invoice ${bill.billNumber}</title><style>body{font-family:Arial,sans-serif;padding:20px;max-width:800px;margin:0 auto}.header{text-align:center;margin-bottom:20px;border-bottom:2px solid #333;padding-bottom:10px}.header h1{margin:0;font-size:24px}.header p{margin:5px 0;color:#666}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}.info-box{padding:10px;background:#f5f5f5;border-radius:5px}.info-box label{font-size:12px;color:#666}.info-box p{margin:5px 0 0;font-weight:bold}table{width:100%;border-collapse:collapse;margin-bottom:20px}th,td{border:1px solid #ddd;padding:10px;text-align:left}th{background:#4a7c59;color:white}.totals{text-align:right}.totals p{margin:5px 0}.grand-total{font-size:18px;font-weight:bold;color:#4a7c59}.footer{margin-top:30px;font-size:12px;color:#666;border-top:1px solid #ddd;padding-top:10px}@media print{body{padding:0}}</style></head><body><div class="header"><h1>${organizationName.toUpperCase()}</h1><p>Professional Catering Services</p><h2>Invoice</h2></div><div class="info-grid"><div class="info-box"><label>Invoice No.</label><p>${bill.billNumber}</p></div><div class="info-box"><label>Date</label><p>${formatDate(bill.billDate)}</p></div><div class="info-box"><label>Customer</label><p>${bill.customerName}</p></div><div class="info-box"><label>Mobile</label><p>${bill.phoneNumber}</p></div>${bill.address ? `<div class="info-box"><label>Address</label><p>${bill.address}</p></div>` : ""}${bill.clientGstNo ? `<div class="info-box"><label>GST No.</label><p>${bill.clientGstNo}</p></div>` : ""}</div><table><thead><tr><th>S.No.</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${bill.items.map((item, idx) => `<tr><td>${idx + 1}</td><td>${item.description}</td><td>${item.quantity}</td><td>₹${item.rate.toLocaleString()}</td><td>₹${item.amount.toLocaleString()}</td></tr>`).join("")}</tbody></table><div class="totals"><p>Subtotal: ₹${bill.subtotal.toLocaleString()}</p>${bill.discountAmount > 0 ? `<p>Discount: -₹${bill.discountAmount.toLocaleString()}</p>` : ""}${bill.sgst > 0 ? `<p>SGST (${bill.sgst}%): ₹${((bill.subtotal - bill.discountAmount) * bill.sgst / 100).toLocaleString()}</p>` : ""}${bill.cgst > 0 ? `<p>CGST (${bill.cgst}%): ₹${((bill.subtotal - bill.discountAmount) * bill.cgst / 100).toLocaleString()}</p>` : ""}<p class="grand-total">Total: ₹${bill.totalAmount.toLocaleString()}</p></div><div class="footer"><p>*Make all cheques payable to ${organizationName}</p><p>Thank you for your business!</p></div><script>window.print();</script></body></html>`
    printWindow.document.write(html); printWindow.document.close()
  }

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="flex items-center gap-2"><Receipt className="w-8 h-8 text-primary" />Billing / बिलिंग</h1>
        <p className="text-muted-foreground mt-1">Create and manage invoices</p>
      </div>

      <div className="flex gap-2 border-b">
        <button onClick={() => setActiveTab("create")} className={cn("px-4 py-2 font-medium border-b-2 -mb-px transition-colors", activeTab === "create" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
          <Plus className="w-4 h-4 inline mr-2" />{editingBill ? `Edit Bill (${editingBill.billNumber})` : "Create Bill"}
        </button>
        <button onClick={() => { setActiveTab("history"); cancelEdit() }} className={cn("px-4 py-2 font-medium border-b-2 -mb-px transition-colors", activeTab === "history" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
          <FileText className="w-4 h-4 inline mr-2" />Bill History
        </button>
      </div>

      {activeTab === "create" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><User className="w-5 h-5" />Customer Information</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Customer Name / ग्राहक का नाम *" placeholder="Enter customer name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                  <Input label="Phone Number / फोन नंबर *" placeholder="Enter phone number" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
                  <Input label="Address / पता" placeholder="Enter address" value={address} onChange={e => setAddress(e.target.value)} />
                  <Input label="Client GST No." placeholder="N/A" value={clientGstNo} onChange={e => setClientGstNo(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2"><FileText className="w-5 h-5" />Bill Items</span>
                  <Button size="sm" onClick={addItem}><Plus className="w-4 h-4 mr-1" />Add Row</Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="border-b text-left text-sm text-muted-foreground"><th className="pb-2 w-8">S.No</th><th className="pb-2">Description</th><th className="pb-2 w-20">Qty</th><th className="pb-2 w-28">Rate (₹)</th><th className="pb-2 w-28">Amount</th><th className="pb-2 w-10"></th></tr></thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="py-2 text-sm text-muted-foreground">{idx + 1}</td>
                          <td className="py-2"><Input placeholder="Event description" value={item.description} onChange={e => updateItem(idx, "description", e.target.value)} className="h-9" /></td>
                          <td className="py-2"><Input type="number" value={item.quantity} onChange={e => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)} className="h-9" /></td>
                          <td className="py-2"><Input type="number" value={item.rate} onChange={e => updateItem(idx, "rate", parseFloat(e.target.value) || 0)} className="h-9" /></td>
                          <td className="py-2 font-medium">₹{(item.quantity * item.rate).toLocaleString()}</td>
                          <td className="py-2">{items.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="h-8 w-8 text-destructive"><Trash2 className="w-4 h-4" /></Button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Percent className="w-5 h-5" />Discount & Tax</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><label className="label mb-1.5 block">Discount Type</label><Select value={discountType} onValueChange={setDiscountType}><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="percentage">Percentage (%)</SelectItem><SelectItem value="fixed">Fixed Amount (₹)</SelectItem></SelectContent></Select></div>
                  <Input label="Discount Value" type="number" placeholder="0" value={discountValue} onChange={e => setDiscountValue(e.target.value)} disabled={!discountType || discountType === "none"} />
                  <Input label="SGST (%)" type="number" placeholder="0" value={sgst} onChange={e => setSgst(e.target.value)} />
                  <Input label="CGST (%)" type="number" placeholder="0" value={cgst} onChange={e => setCgst(e.target.value)} />
                </div>
                <div className="mt-4"><Input label="Notes / टिप्पणी" placeholder="Additional notes..." value={notes} onChange={e => setNotes(e.target.value)} /></div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {phoneNumber.length >= 10 && (
              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Calendar className="w-4 h-4" />Events for {phoneNumber}<Badge variant="secondary">{customerEvents.length}</Badge></CardTitle></CardHeader>
                <CardContent>
                  {loadingEvents ? <Loading className="min-h-[100px]" /> : customerEvents.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No events found</p> : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {customerEvents.map(event => {
                        const catererCost = event.catererCost || 0
                        const clientCost = event.clientCost || 0
                        const profit = event.totalAmount - catererCost
                        const profitPercent = event.totalAmount > 0 ? ((profit / event.totalAmount) * 100).toFixed(1) : "0"
                        const isSelected = selectedEventIds.includes(event.id)
                        const advanceTotal = event.advancePayment || 0
                        const installmentCount = event.advancePayments?.length || 0
                        const meals = event.mealGroups || []
                        
                        return (
                          <div key={event.id} className={cn("p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors", isSelected && "border-primary bg-primary/5")} onClick={() => addEventToBill(event)}>
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-semibold">{formatDate(event.functionDate)}</p>
                                <p className="text-xs text-muted-foreground capitalize">{event.functionTime}</p>
                              </div>
                              <Badge variant={event.status === "completed" ? "success" : "warning"}>{event.status}</Badge>
                            </div>
                            
                            <div className="flex items-center gap-1 text-sm mb-2">
                              <User className="w-3 h-3 text-muted-foreground" />
                              <span className="font-medium">{event.organizerName}</span>
                            </div>
                            
                            {/* UPDATED: Show per-meal breakdown */}
                            <div className="text-sm text-muted-foreground mb-2 space-y-0.5">
                              {meals.length > 0 ? (
                                meals.map((meal, idx) => (
                                  <p key={idx} className="capitalize">{meal.label}: {meal.guests}g × ₹{meal.perPlate.toLocaleString()}</p>
                                ))
                              ) : (
                                <p>{event.guestCount} guests × ₹{event.perPlatePrice}</p>
                              )}
                            </div>
                            
                            <div className="bg-muted/50 rounded p-2 space-y-1.5 text-xs">
                              <div className="flex justify-between"><span className="text-muted-foreground">Client Amount:</span><span className="font-semibold text-primary">₹{event.totalAmount.toLocaleString()}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Package className="w-3 h-3" />Caterer Cost:</span><span className="font-medium text-amber-600">₹{catererCost.toLocaleString()}</span></div>
                              {clientCost > 0 && <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" />Client Cost:</span><span className="font-medium text-blue-600">₹{clientCost.toLocaleString()}</span></div>}
                              {advanceTotal > 0 && <div className="flex justify-between pt-1 border-t border-muted"><span className="text-muted-foreground flex items-center gap-1"><Banknote className="w-3 h-3" />Advance ({installmentCount}):</span><span className="font-semibold text-green-600">₹{advanceTotal.toLocaleString()}</span></div>}
                              <div className="flex justify-between pt-1.5 border-t border-muted"><span className="text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" />Profit:</span><span className={cn("font-semibold", profit >= 0 ? "text-green-600" : "text-red-600")}>₹{profit.toLocaleString()} ({profitPercent}%)</span></div>
                            </div>
                            
                            <p className="text-xs text-primary mt-2">{isSelected ? "✓ Added to bill" : "Click to add to bill"}</p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {selectedEventsAdvanceDetails.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Banknote className="w-4 h-4 text-green-600" />Advance Payments / अग्रिम भुगतान</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedEventsAdvanceDetails.map(ed => (
                      <div key={ed.eventId} className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">{ed.functionTime} — {formatDate(ed.functionDate)}</p>
                        {ed.advancePayments.map((p, idx) => (
                          <div key={p.id} className="flex items-center justify-between p-2 bg-green-50 border border-green-100 rounded text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center text-[10px]">{idx + 1}</span>
                              <span className="font-semibold text-green-700">₹{p.amount.toLocaleString()}</span>
                              <span className="text-muted-foreground">{formatDate(p.paidDate)}</span>
                            </div>
                          </div>
                        ))}
                        <div className="flex justify-between text-xs font-medium pt-1 border-t"><span>Subtotal</span><span className="text-green-700">₹{ed.advancePayment.toLocaleString()}</span></div>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-2 border-t-2 border-green-200"><span className="text-sm font-semibold">Total Advance</span><span className="text-lg font-bold text-green-700 flex items-center"><IndianRupee className="w-4 h-4" />{totalAdvanceForSelected.toLocaleString()}</span></div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="sticky top-4">
              <CardHeader><CardTitle className="flex items-center gap-2"><IndianRupee className="w-5 h-5" />Bill Summary</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{subtotal.toLocaleString()}</span></div>
                  {discountAmount > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>-₹{discountAmount.toLocaleString()}</span></div>}
                  {parseFloat(sgst) > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">SGST ({sgst}%)</span><span>₹{sgstAmount.toLocaleString()}</span></div>}
                  {parseFloat(cgst) > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">CGST ({cgst}%)</span><span>₹{cgstAmount.toLocaleString()}</span></div>}
                  <div className="border-t pt-3"><div className="flex justify-between text-lg font-bold"><span>Total</span><span className="text-primary">₹{totalAmount.toLocaleString()}</span></div></div>
                  {totalAdvanceForSelected > 0 && (<>
                    <div className="flex justify-between text-green-600"><span className="flex items-center gap-1"><Banknote className="w-3 h-3" />Advance Paid</span><span>-₹{totalAdvanceForSelected.toLocaleString()}</span></div>
                    <div className="border-t pt-2"><div className="flex justify-between text-lg font-bold"><span>Balance Due</span><span className={cn(totalAmount - totalAdvanceForSelected <= 0 ? "text-green-600" : "text-amber-600")}>₹{Math.max(0, totalAmount - totalAdvanceForSelected).toLocaleString()}</span></div>{totalAmount - totalAdvanceForSelected <= 0 && <p className="text-xs text-green-600 text-center mt-1 font-medium">✓ Fully Paid</p>}</div>
                  </>)}
                </div>
                {editingBill ? (
                  <div className="space-y-2 mt-6">
                    <p className="text-sm text-muted-foreground text-center">Editing: {editingBill.billNumber}</p>
                    <Button className="w-full" onClick={handleUpdateBill} loading={creating}><Receipt className="w-4 h-4 mr-2" />Update Bill</Button>
                    <Button className="w-full" variant="outline" onClick={cancelEdit}><X className="w-4 h-4 mr-2" />Cancel Edit</Button>
                  </div>
                ) : (
                  <Button className="w-full mt-6" onClick={handleCreateBill} loading={creating}><Receipt className="w-4 h-4 mr-2" />Create Bill / बिल बनाएं</Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <Card><CardContent className="pt-4"><div className="flex flex-wrap gap-4"><div className="w-48"><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue placeholder="All Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="partial">Partial</SelectItem><SelectItem value="unpaid">Unpaid</SelectItem></SelectContent></Select></div><Input placeholder="Search by phone..." value={searchPhone} onChange={e => setSearchPhone(e.target.value)} className="w-48" /></div></CardContent></Card>

          {loadingBills ? <Loading /> : bills.length === 0 ? <EmptyState icon={FileText} title="No bills found" description="Create your first bill" /> : (
            <div className="space-y-4">
              {bills.map(bill => (
                <Card key={bill.id}>
                  <CardContent className="pt-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-muted-foreground">{bill.billNumber}</span>
                          <Badge variant={bill.status === "paid" ? "success" : bill.status === "partial" ? "warning" : "destructive"}>
                            {bill.status === "paid" && <CheckCircle className="w-3 h-3 mr-1" />}{bill.status === "unpaid" && <AlertCircle className="w-3 h-3 mr-1" />}{bill.status === "partial" && <Clock className="w-3 h-3 mr-1" />}{bill.status.charAt(0).toUpperCase() + bill.status.slice(1)}
                          </Badge>
                        </div>
                        <h3 className="font-bold text-lg mt-1">{bill.customerName}</h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-4"><span className="flex items-center gap-1"><Phone className="w-3 h-3" />{bill.phoneNumber}</span><span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(bill.billDate)}</span></p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">₹{bill.totalAmount.toLocaleString()}</p>
                        {(bill.advanceTotal || 0) > 0 && <p className="text-sm text-green-600 font-medium flex items-center justify-end gap-1"><Banknote className="w-3 h-3" />Advance: ₹{(bill.advanceTotal || 0).toLocaleString()}</p>}
                        {(bill.advanceTotal || 0) > 0 && <p className={cn("text-sm font-semibold", bill.totalAmount - (bill.advanceTotal || 0) <= 0 ? "text-green-600" : "text-amber-600")}>{bill.totalAmount - (bill.advanceTotal || 0) <= 0 ? "✓ Fully Paid" : `Balance: ₹${(bill.totalAmount - (bill.advanceTotal || 0)).toLocaleString()}`}</p>}
                        {bill.paidAmount > 0 && bill.paidAmount < bill.totalAmount && !(bill.advanceTotal) && <p className="text-sm text-muted-foreground">Paid: ₹{bill.paidAmount.toLocaleString()}</p>}
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-muted-foreground">{bill.items.slice(0, 2).map((item, i) => <p key={i}>{item.description} - ₹{item.amount.toLocaleString()}</p>)}{bill.items.length > 2 && <p>+{bill.items.length - 2} more items</p>}</div>
                    <div className="mt-4 pt-4 border-t flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => printBill(bill)}><Printer className="w-4 h-4 mr-1" />Print</Button>
                      <Button size="sm" variant="outline" onClick={() => startEditBill(bill)}><FileText className="w-4 h-4 mr-1" />Edit</Button>
                      {bill.status !== "paid" && <Button size="sm" variant="outline" onClick={() => markAsPaid(bill.id, bill.totalAmount)}><Check className="w-4 h-4 mr-1" />Mark Paid</Button>}
                      {bill.status === "paid" && <Button size="sm" variant="outline" onClick={() => updateBillStatus(bill.id, "unpaid")}><X className="w-4 h-4 mr-1" />Mark Unpaid</Button>}
                      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => deleteBill(bill.id)} loading={deleting === bill.id}><Trash2 className="w-4 h-4 mr-1" />Delete</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
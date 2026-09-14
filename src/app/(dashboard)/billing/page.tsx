"use client"

import { useState, useEffect } from "react"
import { 
  FileText, Plus, Phone, Trash2, Printer,
  Calendar, Receipt, Clock, CheckCircle,
  AlertCircle, Banknote
} from "lucide-react"
import { Button, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui"
import { Card, CardContent, Loading, Badge, EmptyState } from "@/components/shared"
import { RecordPaymentDialog, type PayableEvent, type RecordedPayment, type BillRecord } from "@/components/billing" // CHANGED: replaces Mark Paid
import { useToast } from "@/hooks/useToast"
import { api } from "@/lib/apiClient" // CHANGED: normalises fetch + error handling
import { useSWRFetch } from "@/hooks/useSWRFetch"
import { formatDate, cn } from "@/lib/utils"
import { useConfirm } from "@/components/shared"

// =============================================
// BILL REGISTER
// =============================================
// CHANGED: this page used to be two things — a "Create Bill" tab and a bill list. Bills
// now START from the Event History page, where the operator is already looking at the
// event he wants to invoice, and are composed at /billing/new. What is left here is the
// register: the numbered record of every invoice issued, which is a real and separate
// need (GST, "show me what I billed this year") that an event row cannot answer.
//
// Mark Paid / Mark Unpaid are gone. A bill's status is DERIVED from its events'
// payments by the API, and money is added by recording a dated payment.

export default function BillingPage() {

  // CHANGED: staff must not reach this page. Hiding the navbar link and the dashboard
  // tile is not access control — typing the URL got you in, and because the billing APIs
  // correctly return 403 the page simply rendered empty, which looks like a broken app
  // rather than a refusal. The APIs stay the real enforcement; this is the UI half.
  // window.location.replace, not router.push: a soft nav keeps this component mounted
  // and it re-runs its fetches (the documented cause of the old redirect loop).
  useEffect(() => {
    let cancelled = false
    fetch("/api/user/organization")
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (d.success && d.data.role !== "owner") window.location.replace("/dashboard")
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  const { toast } = useToast()
  const [organizationName, setOrganizationName] = useState("Your Business")
  const confirm = useConfirm()

  const [deleting, setDeleting] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchPhone, setSearchPhone] = useState("")

  // CHANGED: record-payment state. payingBill holds the bill being paid; its covered
  // events are fetched on open, because only the bill detail route knows which events
  // it covers and what each of them still owes.
  const [payingBill, setPayingBill] = useState<BillRecord | null>(null)
  const [payableEvents, setPayableEvents] = useState<PayableEvent[]>([])
  const [recordedPayments, setRecordedPayments] = useState<RecordedPayment[]>([])
  const [loadingPayable, setLoadingPayable] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null)

  const { data: bills = [], isLoading: loadingBills, mutate: mutateBills } = useSWRFetch<BillRecord[]>(
    `/api/bills?status=${statusFilter}${searchPhone ? `&phoneNumber=${searchPhone}` : ""}`
  )

  useEffect(() => {
    const fetchOrg = async () => {
      try { const res = await fetch("/api/user/organization"); const data = await res.json(); if (data.success && data.data.organizationName) setOrganizationName(data.data.organizationName) } catch {}
    }
    fetchOrg()
  }, [])

  // One fetch serves the whole dialog: which events the bill covers and what each still
  // owes (for the waterfall), plus the payments already recorded against it.
  const loadBillDetail = async (billId: string) => {
    const res = await fetch(`/api/bills/${billId}`)
    const data = await res.json()
    if (!data.success) throw new Error(data.error || "Failed")
    setPayableEvents(data.data.events || [])
    setRecordedPayments(data.data.payments || [])
  }

  const openPayment = async (bill: BillRecord) => {
    setPayingBill(bill)
    setPayableEvents([])
    setRecordedPayments([])
    setLoadingPayable(true)
    try {
      await loadBillDetail(bill.id)
    } catch {
      toast({ title: "Error", description: "Could not load this bill's events", variant: "destructive" })
    } finally {
      setLoadingPayable(false)
    }
  }

  const deletePayment = async (groupId: string) => {
    if (!payingBill) return
    const ok = await confirm({
      title: "Remove this payment?",
      description: "The payment will be removed from every event it was split across, and the balances recalculated."
    })
    if (!ok) return
    setDeletingGroupId(groupId)
    try {
      await api.del(`/api/bills/${payingBill.id}/payments?groupId=${encodeURIComponent(groupId)}`)
      // Reload the bill so the balances the waterfall proposes reflect the removal.
      await loadBillDetail(payingBill.id)
      mutateBills()
      toast({ title: "Success", description: "Payment removed" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed", variant: "destructive" })
    } finally {
      setDeletingGroupId(null)
    }
  }

  const submitPayment = async (payload: {
    amount: number; paidDate: string; notes: string
    allocations: { eventId: string; amount: number }[]
  }) => {
    if (!payingBill) return
    setSavingPayment(true)
    try {
      await api.post(`/api/bills/${payingBill.id}/payments`, payload)
      // The bill's status and paid amount are derived server-side from these rows, so
      // refetching is all that is needed — there is no status field to set.
      mutateBills()
      setPayingBill(null)
      toast({ title: "Success", description: "Payment recorded" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed", variant: "destructive" })
    } finally {
      setSavingPayment(false)
    }
  }

  const deleteBill = async (billId: string) => {
    const ok = await confirm({ title: "Delete this bill?", description: "This bill and all its items will be permanently removed. This cannot be undone." })
    if (!ok) return
    setDeleting(billId)
    try { await api.del(`/api/bills/${billId}`); mutateBills(); toast({ title: "Success", description: "Bill deleted" }) }
    catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }) }
    finally { setDeleting(null) }
  }

  const printBill = (bill: BillRecord) => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return
    const html = `<!DOCTYPE html><html><head><title>Invoice ${bill.billNumber}</title><style>body{font-family:Arial,sans-serif;padding:20px;max-width:800px;margin:0 auto}.header{text-align:center;margin-bottom:20px;border-bottom:2px solid #333;padding-bottom:10px}.header h1{margin:0;font-size:24px}.header p{margin:5px 0;color:#666}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}.info-box{padding:10px;background:#f5f5f5;border-radius:5px}.info-box label{font-size:12px;color:#666}.info-box p{margin:5px 0 0;font-weight:bold}table{width:100%;border-collapse:collapse;margin-bottom:20px}th,td{border:1px solid #ddd;padding:10px;text-align:left}th{background:#4a7c59;color:white}.totals{text-align:right}.totals p{margin:5px 0}.grand-total{font-size:18px;font-weight:bold;color:#4a7c59}.footer{margin-top:30px;font-size:12px;color:#666;border-top:1px solid #ddd;padding-top:10px}@media print{body{padding:0}}</style></head><body><div class="header"><h1>${organizationName.toUpperCase()}</h1><p>Professional Catering Services</p><h2>Invoice</h2></div><div class="info-grid"><div class="info-box"><label>Invoice No.</label><p>${bill.billNumber}</p></div><div class="info-box"><label>Date</label><p>${formatDate(bill.billDate)}</p></div><div class="info-box"><label>Customer</label><p>${bill.customerName}</p></div><div class="info-box"><label>Mobile</label><p>${bill.phoneNumber}</p></div>${bill.address ? `<div class="info-box"><label>Address</label><p>${bill.address}</p></div>` : ""}${bill.clientGstNo ? `<div class="info-box"><label>GST No.</label><p>${bill.clientGstNo}</p></div>` : ""}</div><table><thead><tr><th>S.No.</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${bill.items.map((item, idx) => `<tr><td>${idx + 1}</td><td>${item.description}</td><td>${item.quantity}</td><td>₹${item.rate.toLocaleString("en-IN")}</td><td>₹${item.amount.toLocaleString("en-IN")}</td></tr>`).join("")}</tbody></table><div class="totals"><p>Subtotal: ₹${bill.subtotal.toLocaleString("en-IN")}</p>${bill.discountAmount > 0 ? `<p>Discount: -₹${bill.discountAmount.toLocaleString("en-IN")}</p>` : ""}${bill.sgst > 0 ? `<p>SGST (${bill.sgst}%): ₹${((bill.subtotal - bill.discountAmount) * bill.sgst / 100).toLocaleString("en-IN")}</p>` : ""}${bill.cgst > 0 ? `<p>CGST (${bill.cgst}%): ₹${((bill.subtotal - bill.discountAmount) * bill.cgst / 100).toLocaleString("en-IN")}</p>` : ""}<p class="grand-total">Total: ₹${bill.totalAmount.toLocaleString("en-IN")}</p></div><div class="footer"><p>*Make all cheques payable to ${organizationName}</p><p>Thank you for your business!</p></div><script>window.print();</script></body></html>`
    printWindow.document.write(html); printWindow.document.close()
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2"><Receipt className="w-8 h-8 text-primary" />Bill Register / बिल रजिस्टर</h1>
          <p className="text-muted-foreground mt-1">Every invoice you have issued</p>
        </div>
        {/* CHANGED: bills normally start from Event History, where the events are picked.
            This is the escape hatch for a bill with no event behind it. */}
        <Button variant="outline" onClick={() => window.location.href = "/billing/new"}>
          <Plus className="w-4 h-4 mr-1" />New Bill
        </Button>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="pt-4 text-sm text-muted-foreground">
          To bill an event, open <a href="/event-history" className="text-primary font-medium underline">Event History</a>,
          tick the events for one customer and press <span className="font-medium">Create Bill</span>.
        </CardContent>
      </Card>

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
                        <p className="text-2xl font-bold text-primary">₹{bill.totalAmount.toLocaleString("en-IN")}</p>
                        {(bill.advanceTotal || 0) > 0 && <p className="text-sm text-green-600 font-medium flex items-center justify-end gap-1"><Banknote className="w-3 h-3" />Advance: ₹{(bill.advanceTotal || 0).toLocaleString("en-IN")}</p>}
                        {(bill.advanceTotal || 0) > 0 && <p className={cn("text-sm font-semibold", bill.totalAmount - (bill.advanceTotal || 0) <= 0 ? "text-green-600" : "text-amber-600")}>{bill.totalAmount - (bill.advanceTotal || 0) <= 0 ? "✓ Fully Paid" : `Balance: ₹${(bill.totalAmount - (bill.advanceTotal || 0)).toLocaleString("en-IN")}`}</p>}
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-muted-foreground">{bill.items.slice(0, 2).map((item, i) => <p key={i}>{item.description} - ₹{item.amount.toLocaleString("en-IN")}</p>)}{bill.items.length > 2 && <p>+{bill.items.length - 2} more items</p>}</div>
                    <div className="mt-4 pt-4 border-t flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => printBill(bill)}><Printer className="w-4 h-4 mr-1" />Print</Button>
                      <Button size="sm" variant="outline" onClick={() => window.location.href = `/billing/new?bill=${bill.id}`}><FileText className="w-4 h-4 mr-1" />Edit</Button>
                      {/* CHANGED: Mark Paid / Mark Unpaid are gone. They set a status with
                          no money behind it; this records a dated payment instead, and the
                          status follows from the amounts. */}
                      {/* CHANGED: shown even when the bill reads as paid — that is exactly
                          when you need to reach a mistyped payment to remove it. */}
                      <Button size="sm" variant="outline" onClick={() => openPayment(bill)}>
                        <Banknote className="w-4 h-4 mr-1" />
                        {bill.status === "paid" ? "Payments" : "Record Payment"}
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => deleteBill(bill.id)} loading={deleting === bill.id}><Trash2 className="w-4 h-4 mr-1" />Delete</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
      </div>

      {payingBill && !loadingPayable && (
        <RecordPaymentDialog
          open={!!payingBill}
          onOpenChange={open => { if (!open) setPayingBill(null) }}
          billNumber={payingBill.billNumber}
          billTotal={payingBill.totalAmount}
          billPaid={payingBill.paidAmount}
          events={payableEvents}
          payments={recordedPayments}
          saving={savingPayment}
          onSubmit={submitPayment}
          onDelete={deletePayment}
          deletingGroupId={deletingGroupId}
        />
      )}
    </div>
  )
}
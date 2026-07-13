import { supabase } from '@/lib/supabase'
import { logActivity } from '@/features/activity/api'
import type { Invoice, InvoiceItem, Payment, Refund, InvoiceStatus, PaymentMethod } from '@/types'

interface Ctx { agencyId: string; actorId: string }

export const INVOICE_STATUS_BADGE: Record<InvoiceStatus, 'default' | 'info' | 'brand' | 'success' | 'warning' | 'danger'> = {
  draft: 'default', sent: 'brand', viewed: 'info', partially_paid: 'warning', paid: 'success', overdue: 'danger', void: 'default', archived: 'default',
}
export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'manual', label: 'Manual Recording' }, { value: 'credit_card', label: 'Credit Card' },
  { value: 'ach', label: 'ACH' }, { value: 'bank_transfer', label: 'Bank Transfer' },
]

export async function listInvoices(clientId?: string): Promise<Invoice[]> {
  let q = supabase.from('invoices').select('*').order('created_at', { ascending: false })
  if (clientId) q = q.eq('client_id', clientId)
  const { data, error } = await q
  if (error) { console.error('listInvoices:', error.message); throw new Error(error.message) }
  return (data ?? []) as Invoice[]
}
export async function listClientInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase.from('invoices_client').select('*').order('created_at', { ascending: false })
  if (error) { console.error('listClientInvoices:', error.message); return [] }
  return (data ?? []) as Invoice[]
}
export async function listPaymentsByClient(clientId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('client_id', clientId)
    .order('recorded_at', { ascending: false })
  if (error) { console.error('listPaymentsByClient:', error.message); throw new Error(error.message) }
  return (data ?? []) as Payment[]
}
export async function getInvoice(id: string): Promise<{ invoice: Invoice | null; items: InvoiceItem[]; payments: Payment[] }> {
  const [{ data: inv }, { data: items }, { data: pays }] = await Promise.all([
    supabase.from('invoices').select('*').eq('id', id).maybeSingle(),
    supabase.from('invoice_items').select('*').eq('invoice_id', id).order('sort_order'),
    supabase.from('payments').select('*').eq('invoice_id', id).order('recorded_at'),
  ])
  return { invoice: (inv as Invoice) ?? null, items: (items ?? []) as InvoiceItem[], payments: (pays ?? []) as Payment[] }
}

export interface InvoiceFormValues { client_id: string; title: string; total_cents: number; due_date: string; is_recurring: boolean; recurrence: string; notes: string }
export async function createInvoice(v: InvoiceFormValues, ctx: Ctx): Promise<Invoice> {
  const num = `INV-${Date.now().toString().slice(-6)}`
  const { data, error } = await supabase.from('invoices').insert({
    agency_id: ctx.agencyId, client_id: v.client_id, number: num, title: v.title.trim() || null,
    subtotal_cents: v.total_cents, total_cents: v.total_cents, due_date: v.due_date || null,
    is_recurring: v.is_recurring, recurrence: v.is_recurring ? v.recurrence : null, notes: v.notes.trim() || null,
    issued_at: new Date().toISOString(), created_by: ctx.actorId, updated_by: ctx.actorId,
  }).select('*').single()
  if (error || !data) throw new Error(error?.message ?? 'Could not create invoice')
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: v.client_id, action: 'invoice.created', entityType: 'invoice', entityId: data.id, description: `Created invoice ${num}` })
  return data as Invoice
}
export async function setInvoiceStatus(inv: Invoice, status: InvoiceStatus, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('invoices').update({ status, updated_by: ctx.actorId }).eq('id', inv.id)
  if (error) throw new Error(error.message)
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: inv.client_id, action: 'invoice.status_changed', entityType: 'invoice', entityId: inv.id, description: `Invoice ${inv.number} → ${status}` })
}
/** @deprecated Use recordInvoicePaymentSafe instead. */
export async function recordPayment(inv: Invoice, amountCents: number, method: PaymentMethod, ctx: Ctx): Promise<void> {
  const { error } = await supabase.from('payments').insert({ agency_id: ctx.agencyId, client_id: inv.client_id, invoice_id: inv.id, amount_cents: amountCents, method, recorded_by: ctx.actorId })
  if (error) throw new Error(error.message)
  await logActivity({ agencyId: ctx.agencyId, actorId: ctx.actorId, clientId: inv.client_id, action: 'payment.recorded', entityType: 'invoice', entityId: inv.id, description: `Recorded payment on ${inv.number}` })
}

function _fmtCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function parsePaymentError(msg: string): string {
  if (msg.includes('invoice_not_found'))        return 'Invoice not found or access denied.'
  if (msg.includes('invoice_void_or_archived')) return 'Cannot record payment against a void or archived invoice.'
  if (msg.includes('invoice_draft'))            return 'Invoice must be sent before recording a payment.'
  if (msg.includes('invoice_already_paid'))     return 'This invoice has already been fully paid.'
  if (msg.includes('amount_invalid'))           return 'Amount must be greater than zero.'
  if (msg.includes('overpayment')) {
    const m = msg.match(/(\d+) cents outstanding/)
    if (m) return `Amount exceeds the outstanding balance of ${_fmtCents(parseInt(m[1], 10))}.`
    return 'Amount exceeds the outstanding balance on this invoice.'
  }
  return msg
}

export async function recordInvoicePaymentSafe(
  invoiceId: string,
  amountCents: number,
  method: PaymentMethod,
  note: string,
  idempotencyKey: string,
  ctx: Ctx,
): Promise<{ payment: Payment; invoice: Invoice; idempotent: boolean }> {
  const { data, error } = await supabase.rpc('record_invoice_payment_safe', {
    p_invoice_id:      invoiceId,
    p_amount_cents:    amountCents,
    p_method:          method,
    p_note:            note || null,
    p_idempotency_key: idempotencyKey,
    p_actor_id:        ctx.actorId,
  })
  if (error) throw new Error(parsePaymentError(error.message))
  const result = data as { payment: Payment; invoice: Invoice; idempotent: boolean }
  if (!result.idempotent) {
    await logActivity({
      agencyId: ctx.agencyId, actorId: ctx.actorId,
      clientId: result.payment.client_id,
      action: 'payment.recorded', entityType: 'invoice', entityId: invoiceId,
      description: `Recorded ${_fmtCents(amountCents)} payment on invoice`,
    })
  }
  return result
}

export async function listRefundsByClient(clientId: string): Promise<Refund[]> {
  const { data, error } = await supabase
    .from('refunds')
    .select('*')
    .eq('client_id', clientId)
    .order('refunded_at', { ascending: false })
  if (error) { console.error('listRefundsByClient:', error.message); throw new Error(error.message) }
  return (data ?? []) as Refund[]
}

/** Returns total payment amount_cents recorded in the current calendar month. */
export async function getMonthlyRevenue(): Promise<number> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const { data } = await supabase.from('payments').select('amount_cents').gte('recorded_at', startOfMonth)
  return ((data ?? []) as { amount_cents: number }[]).reduce((sum, p) => sum + p.amount_cents, 0)
}

export interface BillingMetrics { monthly: number; outstanding: number; collected: number; overdue: number }
export function computeBillingMetrics(invoices: Invoice[]): BillingMetrics {
  const now = new Date(); const m: BillingMetrics = { monthly: 0, outstanding: 0, collected: 0, overdue: 0 }
  for (const i of invoices) {
    if (i.status === 'void' || i.status === 'archived' || i.status === 'draft') continue
    m.collected += i.amount_paid_cents
    m.outstanding += Math.max(i.total_cents - i.amount_paid_cents, 0)
    if (i.issued_at && new Date(i.issued_at).getMonth() === now.getMonth() && new Date(i.issued_at).getFullYear() === now.getFullYear()) m.monthly += i.total_cents
    if (i.due_date && new Date(i.due_date) < now && i.amount_paid_cents < i.total_cents) m.overdue += i.total_cents - i.amount_paid_cents
  }
  return m
}

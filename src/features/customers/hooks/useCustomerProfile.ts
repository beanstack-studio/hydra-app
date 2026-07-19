import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Customer, CustomerInput } from '../types'
import type { SaleWithPayments, PaymentMode } from '@/features/sales/types'

type BulkPaymentMode = 'cash' | 'gcash' | 'maya'

interface UseCustomerProfileReturn {
  customer: Customer | null
  sales: SaleWithPayments[]
  isLoading: boolean
  error: string | null
  recordPayment: (
    saleId: string,
    amount: number,
    paymentMode: PaymentMode,
    paidAt: string,
    remarks: string,
  ) => Promise<void>
  recordBulkPayment: (
    saleIds: string[],
    amount: number,
    paymentMode: BulkPaymentMode,
    paidAt: string,
  ) => Promise<void>
  updateCustomer: (id: string, input: Partial<CustomerInput>) => Promise<void>
}

export function useCustomerProfile(customerId: string | undefined): UseCustomerProfileReturn {
  const stationId = useAuthStore((s) => s.stationId)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [sales, setSales] = useState<SaleWithPayments[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!customerId || !stationId) { setIsLoading(false); return }
    setError(null)
    try {
      // Phase 1 — customer info + total sales count in parallel.
      // We need the count before we can issue the right number of range queries.
      const [custRes, countRes] = await Promise.all([
        supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .eq('station_id', stationId)
          .single(),
        supabase
          .from('sales')
          .select('*', { count: 'exact', head: true })
          .eq('customer_id', customerId)
          .eq('station_id', stationId),
      ])
      if (custRes.error) throw new Error(custRes.error.message)
      if (countRes.error) throw new Error(countRes.error.message)

      const total = countRes.count ?? 0
      let allSales: SaleWithPayments[] = []

      if (total > 0) {
        // Phase 2 — fetch all pages in parallel (1 000 rows/batch).
        // Supabase silently caps un-limited queries at 1 000 rows; customers
        // with many orders would lose older history without this two-phase approach.
        const batchCount = Math.ceil(total / 1000)
        const batchResults = await Promise.all(
          Array.from({ length: batchCount }, (_, i) =>
            supabase
              .from('sales')
              .select('*, sale_payments(*)')
              .eq('customer_id', customerId)
              .eq('station_id', stationId)
              .order('created_at', { ascending: false })
              .range(i * 1000, i * 1000 + 999)
          )
        )
        for (const res of batchResults) {
          if (res.error) throw new Error(res.error.message)
        }
        allSales = batchResults.flatMap((r) => (r.data ?? []) as SaleWithPayments[])
      }

      setCustomer(custRes.data as Customer)
      setSales(allSales)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customer')
    } finally {
      setIsLoading(false)
    }
  }, [customerId, stationId])

  useEffect(() => { void fetchData() }, [fetchData])

  const recordPayment = useCallback(async (
    saleId: string,
    amount: number,
    paymentMode: PaymentMode,
    paidAt: string,
    remarks: string,
  ) => {
    const sale = sales.find((s) => s.id === saleId)
    if (!sale) throw new Error('Sale not found')

    const newAmountReceived = sale.amount_received + amount
    const newBalance = sale.total_amount - newAmountReceived
    const newStatus = newBalance <= 0 ? 'paid' : 'partial'

    const { error: updateErr } = await supabase
      .from('sales')
      .update({ amount_received: newAmountReceived, status: newStatus, payment_mode: paymentMode })
      .eq('id', saleId)
    if (updateErr) throw new Error(updateErr.message)

    const { error: paymentErr } = await supabase
      .from('sale_payments')
      .insert({
        station_id: stationId,
        sale_id: saleId,
        amount,
        payment_mode: paymentMode,
        paid_at: paidAt,
        remarks: remarks || null,
      })
    if (paymentErr) throw new Error(paymentErr.message)

    await fetchData()
  }, [sales, stationId, fetchData])

  const recordBulkPayment = useCallback(async (
    saleIds: string[],
    amount: number,
    paymentMode: BulkPaymentMode,
    paidAt: string,
  ) => {
    const targets = sales.filter((s) => saleIds.includes(s.id) && s.status !== 'paid')
    // Sort oldest-first so payment is applied in chronological order
    const sorted = [...targets].sort((a, b) => a.sale_date.localeCompare(b.sale_date))

    // Pre-compute allocations before hitting the DB
    let remaining = amount
    const allocations: Array<{
      sale: SaleWithPayments
      applying: number
      newAmountReceived: number
      newStatus: 'paid' | 'partial'
    }> = []
    for (const sale of sorted) {
      if (remaining <= 0) break
      const applying = Math.min(remaining, sale.balance_due)
      remaining -= applying
      const newAmountReceived = sale.amount_received + applying
      const newBalance = sale.total_amount - newAmountReceived
      const newStatus: 'paid' | 'partial' = newBalance <= 0 ? 'paid' : 'partial'
      allocations.push({ sale, applying, newAmountReceived, newStatus })
    }

    await Promise.all(allocations.map(async ({ sale, applying, newAmountReceived, newStatus }) => {
      const { error: updateErr } = await supabase
        .from('sales')
        .update({
          amount_received: newAmountReceived,
          status: newStatus,
          payment_mode: paymentMode,
          ...(newStatus === 'paid' ? { paid_at: paidAt } : {}),
        })
        .eq('id', sale.id)
      if (updateErr) throw new Error(updateErr.message)

      const { error: payErr } = await supabase
        .from('sale_payments')
        .insert({
          station_id: stationId,
          sale_id: sale.id,
          amount: applying,
          payment_mode: paymentMode,
          paid_at: paidAt,
          remarks: newStatus === 'paid' ? 'Bulk payment' : 'Partial bulk payment',
        })
      if (payErr) throw new Error(payErr.message)
    }))
    await fetchData()
  }, [sales, stationId, fetchData])

  const updateCustomer = useCallback(async (id: string, input: Partial<CustomerInput>) => {
    const { error: e } = await supabase.from('customers').update(input).eq('id', id)
    if (e) throw new Error(e.message)
    await fetchData()
  }, [fetchData])

  return { customer, sales, isLoading, error, recordPayment, recordBulkPayment, updateCustomer }
}

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Customer, CustomerInput } from '../types'
import type { SaleWithPayments, PaymentMode } from '@/features/sales/types'

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
      const [custRes, salesRes] = await Promise.all([
        supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .eq('station_id', stationId)
          .single(),
        supabase
          .from('sales')
          .select('*, sale_payments(*)')
          .eq('customer_id', customerId)
          .eq('station_id', stationId)
          .order('created_at', { ascending: false }),
      ])
      if (custRes.error) throw new Error(custRes.error.message)
      if (salesRes.error) throw new Error(salesRes.error.message)
      setCustomer(custRes.data as Customer)
      setSales((salesRes.data ?? []) as SaleWithPayments[])
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

  const updateCustomer = useCallback(async (id: string, input: Partial<CustomerInput>) => {
    const { error: e } = await supabase.from('customers').update(input).eq('id', id)
    if (e) throw new Error(e.message)
    await fetchData()
  }, [fetchData])

  return { customer, sales, isLoading, error, recordPayment, updateCustomer }
}

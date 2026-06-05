import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Sale, PaymentMode } from '../types'

interface RecordPaymentInput {
  saleId: string
  amount: number
  paymentMode: PaymentMode
  paidAt: string
  remarks: string
}

interface UseUnpaidSalesReturn {
  data: Sale[]
  isLoading: boolean
  error: string | null
  recordPayment: (input: RecordPaymentInput) => Promise<void>
}

export function useUnpaidSales(): UseUnpaidSalesReturn {
  const stationId = useAuthStore((s) => s.stationId)
  const [data, setData] = useState<Sale[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) { setIsLoading(false); return }
    setError(null)
    try {
      const { data: rows, error: e } = await supabase
        .from('sales')
        .select('*')
        .eq('station_id', stationId)
        .in('status', ['unpaid', 'partial'])
        .order('created_at', { ascending: false })
      if (e) throw new Error(e.message)
      setData((rows ?? []) as Sale[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load unpaid sales')
    } finally {
      setIsLoading(false)
    }
  }, [stationId])

  useEffect(() => {
    void fetchData()
    if (!stationId) return
    const channel = supabase
      .channel(`unpaid_sales:${stationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `station_id=eq.${stationId}` }, () => { void fetchData() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [fetchData, stationId])

  const recordPayment = useCallback(async ({ saleId, amount, paymentMode, paidAt, remarks }: RecordPaymentInput) => {
    const sale = data.find((s) => s.id === saleId)
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
  }, [data, stationId, fetchData])

  return { data, isLoading, error, recordPayment }
}

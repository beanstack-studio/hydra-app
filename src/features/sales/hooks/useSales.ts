import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Sale, SaleInsert, PaymentMode } from '../types'

async function deductLinkedSupplies(stationId: string, productId: string, qtySold: number) {
  const { data: linked } = await supabase
    .from('supplies')
    .select('id, qty, units_per_sale')
    .eq('station_id', stationId)
    .eq('linked_product_id', productId)
  if (!linked || linked.length === 0) return
  await Promise.all(
    (linked as { id: string; qty: number; units_per_sale: number }[]).map((s) => {
      const newQty = Math.max(0, s.qty - qtySold * s.units_per_sale)
      return supabase.from('supplies').update({ qty: newQty }).eq('id', s.id)
    })
  )
}

interface UseSalesReturn {
  data: Sale[]
  isLoading: boolean
  error: string | null
  addSale: (input: SaleInsert) => Promise<Sale>
  recordPayment: (saleId: string, amount: number, paymentMode: PaymentMode, paidAt: string, remarks: string) => Promise<void>
  rescheduleOrder: (saleId: string, scheduledAt: string) => Promise<void>
  refetch: () => Promise<void>
}

export function useSales(): UseSalesReturn {
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
        .order('created_at', { ascending: false })
      if (e) throw new Error(e.message)
      setData((rows ?? []) as Sale[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sales')
    } finally {
      setIsLoading(false)
    }
  }, [stationId])

  useEffect(() => {
    void fetchData()
    if (!stationId) return
    const channel = supabase
      .channel(`sales:${stationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `station_id=eq.${stationId}` }, () => { void fetchData() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [fetchData, stationId])

  const addSale = useCallback(async (input: SaleInsert): Promise<Sale> => {
    const { data: row, error: e } = await supabase
      .from('sales')
      .insert(input)
      .select()
      .single()
    if (e) throw new Error(e.message)
    // Deduct linked supplies silently — failure doesn't block the sale
    if (stationId && input.product_id) {
      void deductLinkedSupplies(stationId, input.product_id, input.qty)
    }
    await fetchData()
    return row as Sale
  }, [fetchData, stationId])

  const recordPayment = useCallback(async (
    saleId: string, amount: number, paymentMode: PaymentMode, paidAt: string, remarks: string
  ) => {
    const sale = data.find((s) => s.id === saleId)
    if (!sale) throw new Error('Sale not found')

    const newAmountReceived = (sale.amount_received ?? 0) + amount
    const newBalance = sale.total_amount - newAmountReceived
    const newStatus = newBalance <= 0 ? 'paid' : 'partial'

    const { error: updateErr } = await supabase
      .from('sales')
      .update({ amount_received: newAmountReceived, status: newStatus, payment_mode: paymentMode })
      .eq('id', saleId)
    if (updateErr) throw new Error(updateErr.message)

    const { error: paymentErr } = await supabase
      .from('sale_payments')
      .insert({ station_id: stationId, sale_id: saleId, amount, payment_mode: paymentMode, paid_at: paidAt, remarks: remarks || null })
    if (paymentErr) throw new Error(paymentErr.message)

    await fetchData()
  }, [data, stationId, fetchData])

  const rescheduleOrder = useCallback(async (saleId: string, scheduledAt: string) => {
    const { error: e } = await supabase
      .from('sales')
      .update({ scheduled_at: scheduledAt })
      .eq('id', saleId)
    if (e) throw new Error(e.message)
    // Update the reminder so it fires again at the new time
    await supabase
      .from('reminders')
      .update({ scheduled_at: scheduledAt, is_dismissed: false })
      .eq('sale_id', saleId)
    await fetchData()
  }, [fetchData])

  return { data, isLoading, error, addSale, recordPayment, rescheduleOrder, refetch: fetchData }
}

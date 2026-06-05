import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatInTimeZone } from 'date-fns-tz'
import { PH_TZ } from '@/lib/utils'
import type { Supply, SupplyInput, SupplyStatus } from '../types'

function computeStatus(qty: number, threshold: number): SupplyStatus {
  if (qty <= 0) return 'out_of_stock'
  if (qty <= threshold) return 'low_stock'
  return 'in_stock'
}

interface UseSuppliesReturn {
  data: Supply[]
  isLoading: boolean
  error: string | null
  addSupply: (input: SupplyInput) => Promise<void>
  updateSupply: (id: string, input: SupplyInput) => Promise<void>
  deleteSupply: (id: string) => Promise<void>
  adjustQty: (id: string, newQty: number) => Promise<void>
  logAsExpense: (supply: Supply, qty: number) => Promise<void>
  deductForSale: (productId: string, qtySold: number) => Promise<void>
}

export function useSupplies(): UseSuppliesReturn {
  const stationId = useAuthStore((s) => s.stationId)
  const [data, setData] = useState<Supply[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) { setIsLoading(false); return }
    setError(null)
    try {
      const { data: rows, error: e } = await supabase
        .from('supplies')
        .select('*')
        .eq('station_id', stationId)
        .order('name')
      if (e) throw new Error(e.message)
      setData((rows ?? []) as Supply[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load supplies')
    } finally {
      setIsLoading(false)
    }
  }, [stationId])

  useEffect(() => {
    void fetchData()
    if (!stationId) return
    const channel = supabase
      .channel(`supplies:${stationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supplies', filter: `station_id=eq.${stationId}` }, () => { void fetchData() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [fetchData, stationId])

  const addSupply = useCallback(async (input: SupplyInput) => {
    if (!stationId) return
    const { error: e } = await supabase.from('supplies').insert({
      station_id: stationId,
      ...input,
    })
    if (e) throw new Error(e.message)
    await fetchData()
  }, [stationId, fetchData])

  const updateSupply = useCallback(async (id: string, input: SupplyInput) => {
    const { error: e } = await supabase.from('supplies').update(input).eq('id', id)
    if (e) throw new Error(e.message)
    await fetchData()
  }, [fetchData])

  const deleteSupply = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('supplies').delete().eq('id', id)
    if (e) throw new Error(e.message)
    await fetchData()
  }, [fetchData])

  const adjustQty = useCallback(async (id: string, newQty: number) => {
    const { error: e } = await supabase
      .from('supplies')
      .update({ qty: Math.max(0, newQty) })
      .eq('id', id)
    if (e) throw new Error(e.message)
    await fetchData()
  }, [fetchData])

  // Log a supply purchase as a Supplies expense
  const logAsExpense = useCallback(async (supply: Supply, qty: number) => {
    if (!stationId) return
    const amount = (supply.price_per_unit ?? 0) * qty
    const todayPH = formatInTimeZone(new Date(), PH_TZ, 'yyyy-MM-dd')
    const { error: e } = await supabase.from('expenses').insert({
      station_id: stationId,
      category: 'supplies',
      item: supply.name,
      price: amount,
      amount,
      frequency: 'one_off',
      expense_date: supply.last_purchased_at ?? todayPH,
      payment_method: null,
      remarks: `${qty} × ${supply.name}${supply.store ? ` from ${supply.store}` : ''}`,
    })
    if (e) throw new Error(e.message)
  }, [stationId])

  // Called by useSales after a sale is recorded — deducts linked supplies
  const deductForSale = useCallback(async (productId: string, qtySold: number) => {
    if (!stationId) return
    const linked = data.filter((s) => s.linked_product_id === productId && s.qty > 0)
    if (linked.length === 0) return
    await Promise.all(
      linked.map((s) => {
        const deduct = qtySold * s.units_per_sale
        const newQty = Math.max(0, s.qty - deduct)
        return supabase.from('supplies').update({ qty: newQty }).eq('id', s.id)
      })
    )
    await fetchData()
  }, [stationId, data, fetchData])

  return { data, isLoading, error, addSupply, updateSupply, deleteSupply, adjustQty, logAsExpense, deductForSale }
}

export { computeStatus }

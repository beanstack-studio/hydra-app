import { useState, useEffect, useCallback } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { PH_TZ } from '@/lib/utils'
import type { InventoryItem, StockStatus } from '../types'

interface UseInventoryReturn {
  data: InventoryItem[]
  isLoading: boolean
  error: string | null
  adjustQty: (id: string, newQty: number, threshold: number, expenseAmount?: number) => Promise<void>
}

function computeStatus(qty: number, threshold: number): StockStatus {
  if (qty <= 0) return 'out_of_stock'
  if (qty <= threshold) return 'low_stock'
  return 'in_stock'
}

export function useInventory(): UseInventoryReturn {
  const stationId = useAuthStore((s) => s.stationId)
  const [data, setData] = useState<InventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) { setIsLoading(false); return }
    setError(null)
    try {
      const { data: rows, error: e } = await supabase
        .from('inventory')
        .select('*')
        .eq('station_id', stationId)
        .order('product_name')
      if (e) throw new Error(e.message)
      // status is not stored in DB — compute it from available_qty vs threshold
      const items: InventoryItem[] = (rows ?? []).map((row) => ({
        ...(row as Omit<InventoryItem, 'status'>),
        status: computeStatus(row.available_qty as number, row.threshold as number),
      }))
      setData(items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory')
    } finally {
      setIsLoading(false)
    }
  }, [stationId])

  useEffect(() => {
    void fetchData()
    if (!stationId) return
    const channel = supabase
      .channel(`inventory:${stationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory', filter: `station_id=eq.${stationId}` }, () => { void fetchData() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [fetchData, stationId])

  const adjustQty = useCallback(async (id: string, newQty: number, threshold: number, expenseAmount?: number) => {
    const currentItem = data.find((i) => i.id === id)

    const { error: e } = await supabase
      .from('inventory')
      .update({ available_qty: newQty, threshold, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (e) throw new Error(e.message)

    // When qty increased and a purchase amount was provided, log it as a supplies expense
    if (expenseAmount && expenseAmount > 0 && currentItem && newQty > currentItem.available_qty) {
      const todayPH = formatInTimeZone(new Date(), PH_TZ, 'yyyy-MM-dd')
      const { error: expErr } = await supabase.from('expenses').insert({
        station_id: stationId,
        category: 'supplies',
        item: `Restock: ${currentItem.product_name}`,
        price: expenseAmount,
        amount: expenseAmount,
        frequency: 'one_off',
        expense_date: todayPH,
        payment_method: null,
        remarks: `Restocked ${currentItem.product_name} (${currentItem.available_qty} → ${newQty})`,
      })
      if (expErr) throw new Error(expErr.message)
    }

    await fetchData()
  }, [stationId, fetchData, data])

  return { data, isLoading, error, adjustQty }
}

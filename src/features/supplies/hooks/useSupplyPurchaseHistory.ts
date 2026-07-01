import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Expense } from '@/features/expenses/types'

interface UseSupplyPurchaseHistoryReturn {
  data: Expense[]
  isLoading: boolean
  error: string | null
}

export function useSupplyPurchaseHistory(supplyName: string | null): UseSupplyPurchaseHistoryReturn {
  const stationId = useAuthStore((s) => s.stationId)
  const [data, setData] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId || !supplyName) { setData([]); return }
    setIsLoading(true)
    setError(null)
    try {
      const { data: rows, error: e } = await supabase
        .from('expenses')
        .select('*')
        .eq('station_id', stationId)
        .eq('category', 'supplies')
        .ilike('item', `%${supplyName}%`)
        .order('expense_date', { ascending: false })
        .limit(10)
      if (e) throw new Error(e.message)
      setData((rows ?? []) as Expense[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setIsLoading(false)
    }
  }, [stationId, supplyName])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { data, isLoading, error }
}

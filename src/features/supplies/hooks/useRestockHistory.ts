import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { RestockHistory } from '../types'

interface UseRestockHistoryReturn {
  data: RestockHistory[]
  isLoading: boolean
  error: string | null
}

export function useRestockHistory(supplyId: string | null): UseRestockHistoryReturn {
  const stationId = useAuthStore((s) => s.stationId)
  const [data, setData] = useState<RestockHistory[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId || !supplyId) { setData([]); return }
    setIsLoading(true)
    setError(null)
    try {
      const { data: rows, error: e } = await supabase
        .from('restock_history')
        .select('*')
        .eq('station_id', stationId)
        .eq('supply_id', supplyId)
        .order('restocked_at', { ascending: false })
        .limit(20)
      if (e) throw new Error(e.message)
      setData((rows ?? []) as RestockHistory[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setIsLoading(false)
    }
  }, [stationId, supplyId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { data, isLoading, error }
}

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export interface FilterReplacementHistoryRow {
  id: string
  replaced_at: string
  notes: string | null
  days_since_prev: number | null
}

interface UseFilterReplacementHistoryReturn {
  data: FilterReplacementHistoryRow[]
  isLoading: boolean
  error: string | null
}

export function useFilterReplacementHistory(isOpen: boolean): UseFilterReplacementHistoryReturn {
  const stationId = useAuthStore((s) => s.stationId)
  const [data,      setData]      = useState<FilterReplacementHistoryRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) return
    setIsLoading(true)
    setError(null)
    try {
      const { data: rows, error: e } = await supabase.rpc('get_filter_replacement_history', {
        p_station_id: stationId,
      })
      if (e) throw new Error(e.message)
      setData((rows ?? []) as FilterReplacementHistoryRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load filter replacement history')
    } finally {
      setIsLoading(false)
    }
  }, [stationId])

  useEffect(() => {
    if (isOpen) void fetchData()
  }, [isOpen, fetchData])

  return { data, isLoading, error }
}

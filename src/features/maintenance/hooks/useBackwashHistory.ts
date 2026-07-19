import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export interface BackwashHistoryRow {
  id: string
  backwashed_at: string
  notes: string | null
  refills_since_prev: number | null
}

interface UseBackwashHistoryReturn {
  data: BackwashHistoryRow[]
  isLoading: boolean
  error: string | null
}

export function useBackwashHistory(isOpen: boolean): UseBackwashHistoryReturn {
  const stationId = useAuthStore((s) => s.stationId)
  const [data,      setData]      = useState<BackwashHistoryRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) return
    setIsLoading(true)
    setError(null)
    try {
      const { data: rows, error: e } = await supabase.rpc('get_backwash_history', {
        p_station_id: stationId,
      })
      if (e) throw new Error(e.message)
      setData((rows ?? []) as BackwashHistoryRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load backwash history')
    } finally {
      setIsLoading(false)
    }
  }, [stationId])

  useEffect(() => {
    if (isOpen) void fetchData()
  }, [isOpen, fetchData])

  return { data, isLoading, error }
}

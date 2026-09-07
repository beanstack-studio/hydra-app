import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export interface LabTestHistoryRow {
  id:             string
  tested_at:      string
  notes:          string | null
  days_since_prev: number | null
}

interface UseBacteriologicalTestHistoryReturn {
  data:      LabTestHistoryRow[]
  isLoading: boolean
  error:     string | null
}

export function useBacteriologicalTestHistory(isOpen: boolean): UseBacteriologicalTestHistoryReturn {
  const stationId = useAuthStore((s) => s.stationId)
  const [data,      setData]      = useState<LabTestHistoryRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) return
    setIsLoading(true)
    setError(null)
    try {
      const { data: rows, error: e } = await supabase.rpc('get_bacteriological_test_history', {
        p_station_id: stationId,
      })
      if (e) throw new Error(e.message)
      setData((rows ?? []) as LabTestHistoryRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bacteriological test history')
    } finally {
      setIsLoading(false)
    }
  }, [stationId])

  useEffect(() => {
    if (isOpen) void fetchData()
  }, [isOpen, fetchData])

  return { data, isLoading, error }
}

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { LabTestHistoryRow } from './useBacteriologicalTestHistory'

interface UsePhysicalChemicalTestHistoryReturn {
  data:      LabTestHistoryRow[]
  isLoading: boolean
  error:     string | null
}

export function usePhysicalChemicalTestHistory(isOpen: boolean): UsePhysicalChemicalTestHistoryReturn {
  const stationId = useAuthStore((s) => s.stationId)
  const [data,      setData]      = useState<LabTestHistoryRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) return
    setIsLoading(true)
    setError(null)
    try {
      const { data: rows, error: e } = await supabase.rpc('get_physical_chemical_test_history', {
        p_station_id: stationId,
      })
      if (e) throw new Error(e.message)
      setData((rows ?? []) as LabTestHistoryRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load physical/chemical test history')
    } finally {
      setIsLoading(false)
    }
  }, [stationId])

  useEffect(() => {
    if (isOpen) void fetchData()
  }, [isOpen, fetchData])

  return { data, isLoading, error }
}

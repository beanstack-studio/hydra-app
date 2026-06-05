import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { TimeLog, TimeLogInput } from '../types'

interface UseTimeLogsReturn {
  data: TimeLog[]
  isLoading: boolean
  error: string | null
  addTimeLog: (input: TimeLogInput) => Promise<void>
  updateTimeLog: (id: string, input: Partial<TimeLogInput>) => Promise<void>
  deleteTimeLog: (id: string) => Promise<void>
}

export function useTimeLogs(): UseTimeLogsReturn {
  const stationId = useAuthStore((s) => s.stationId)
  const [data, setData] = useState<TimeLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) { setIsLoading(false); return }
    setError(null)
    try {
      const { data: rows, error: e } = await supabase
        .from('time_logs')
        .select('*')
        .eq('station_id', stationId)
        .order('log_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (e) throw new Error(e.message)
      setData((rows ?? []) as TimeLog[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load time logs')
    } finally {
      setIsLoading(false)
    }
  }, [stationId])

  useEffect(() => { void fetchData() }, [fetchData])

  const addTimeLog = useCallback(async (input: TimeLogInput) => {
    if (!stationId) return
    const { error: e } = await supabase.from('time_logs').insert({ ...input, station_id: stationId })
    if (e) throw new Error(e.message)
    await fetchData()
  }, [stationId, fetchData])

  const updateTimeLog = useCallback(async (id: string, input: Partial<TimeLogInput>) => {
    const { error: e } = await supabase.from('time_logs').update(input).eq('id', id)
    if (e) throw new Error(e.message)
    await fetchData()
  }, [fetchData])

  const deleteTimeLog = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('time_logs').delete().eq('id', id)
    if (e) throw new Error(e.message)
    await fetchData()
  }, [fetchData])

  return { data, isLoading, error, addTimeLog, updateTimeLog, deleteTimeLog }
}

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { StaffSchedule, StaffScheduleInput } from '../types'

interface UseStaffSchedulesReturn {
  data: StaffSchedule[]
  isLoading: boolean
  error: string | null
  saveStaffSchedule: (staffId: string, days: StaffScheduleInput[]) => Promise<void>
}

export function useStaffSchedules(): UseStaffSchedulesReturn {
  const stationId = useAuthStore((s) => s.stationId)
  const [data, setData] = useState<StaffSchedule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) { setIsLoading(false); return }
    setError(null)
    try {
      const { data: rows, error: e } = await supabase
        .from('staff_schedules')
        .select('*')
        .eq('station_id', stationId)
        .order('staff_id')
      if (e) throw new Error(e.message)
      setData((rows ?? []) as StaffSchedule[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedules')
    } finally {
      setIsLoading(false)
    }
  }, [stationId])

  useEffect(() => { void fetchData() }, [fetchData])

  // Delete all existing days for this staff member, then insert the active ones.
  // This is the simplest approach for a 7-day schedule form.
  const saveStaffSchedule = useCallback(async (staffId: string, days: StaffScheduleInput[]) => {
    if (!stationId) return
    const activeDays = days.filter((d) => d.is_active)

    const { error: delErr } = await supabase
      .from('staff_schedules')
      .delete()
      .eq('staff_id', staffId)
      .eq('station_id', stationId)
    if (delErr) throw new Error(delErr.message)

    if (activeDays.length > 0) {
      const { error: insErr } = await supabase.from('staff_schedules').insert(
        activeDays.map((d) => ({
          station_id: stationId,
          staff_id: staffId,
          day_of_week: d.day_of_week,
          shift_start: d.shift_start,
          shift_end: d.shift_end,
          is_active: true,
        }))
      )
      if (insErr) throw new Error(insErr.message)
    }

    await fetchData()
  }, [stationId, fetchData])

  return { data, isLoading, error, saveStaffSchedule }
}

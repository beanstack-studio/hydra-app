import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export function useStaffNames(): string[] {
  const stationId = useAuthStore((s) => s.stationId)
  const [names, setNames] = useState<string[]>([])

  useEffect(() => {
    if (!stationId) return
    void supabase
      .from('staff')
      .select('full_name')
      .eq('station_id', stationId)
      .order('full_name')
      .then(({ data }) => {
        setNames((data ?? []).map((row) => row.full_name as string))
      })
  }, [stationId])

  return names
}

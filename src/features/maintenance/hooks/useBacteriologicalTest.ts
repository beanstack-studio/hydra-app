import { useState, useEffect, useCallback } from 'react'
import { toZonedTime } from 'date-fns-tz'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useBacteriologicalTestStore } from '@/stores/bacteriologicalTestStore'
import { PH_TZ } from '@/lib/utils'

export type LabTestZone = 'green' | 'yellow' | 'red'

export const DEFAULT_BACTERIOLOGICAL_INTERVAL_DAYS = 30
const DEFAULT_ALERT_ENABLED = true

// Zone thresholds — identical to filter replacement:
//   daysRemaining > 5  → green
//   daysRemaining 1–5  → yellow
//   daysRemaining ≤ 0  → red (due today or overdue)
export function computeLabTestZone(daysRemaining: number): LabTestZone {
  if (daysRemaining <= 0) return 'red'
  if (daysRemaining <= 5) return 'yellow'
  return 'green'
}

export interface UseBacteriologicalTestReturn {
  lastTestedAt:  string | null
  daysRemaining: number
  cycleDays:     number
  intervalDays:  number
  alertEnabled:  boolean
  isConfigured:  boolean
  eventsTotal:   number
  zone:          LabTestZone
  isLoading:     boolean
  error:         string | null
  markAsCompleted:  (notes?: string) => Promise<void>
  updateSettings:   (intervalDays: number, alertEnabled: boolean) => Promise<void>
}

export function useBacteriologicalTest(): UseBacteriologicalTestReturn {
  const stationId = useAuthStore((s) => s.stationId)

  const [lastTestedAt,  setLastTestedAt]  = useState<string | null>(null)
  const [daysRemaining, setDaysRemaining] = useState(0)
  const [cycleDays,     setCycleDays]     = useState(DEFAULT_BACTERIOLOGICAL_INTERVAL_DAYS)
  const [intervalDays,  setIntervalDays]  = useState(DEFAULT_BACTERIOLOGICAL_INTERVAL_DAYS)
  const [alertEnabled,  setAlertEnabledState] = useState(DEFAULT_ALERT_ENABLED)
  const [isConfigured,  setIsConfiguredState] = useState(false)
  const [eventsTotal,   setEventsTotal]   = useState(0)
  const [zone,          setZone]          = useState<LabTestZone>('red')
  const [isLoading,     setIsLoading]     = useState(true)
  const [error,         setError]         = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) { setIsLoading(false); return }
    setError(null)
    try {
      const phNow         = toZonedTime(new Date(), PH_TZ)
      const todayMidnight = new Date(phNow.getFullYear(), phNow.getMonth(), phNow.getDate())

      const [logsRes, totalRes, settingsRes] = await Promise.all([
        supabase
          .from('bacteriological_test_logs')
          .select('tested_at')
          .eq('station_id', stationId)
          .order('tested_at', { ascending: false })
          .limit(1),
        supabase
          .from('bacteriological_test_logs')
          .select('*', { count: 'exact', head: true })
          .eq('station_id', stationId),
        supabase
          .from('station_settings')
          .select('bacteriological_test_interval_days, bacteriological_test_alert_enabled')
          .eq('station_id', stationId)
          .maybeSingle(),
      ])

      if (logsRes.error) throw new Error(logsRes.error.message)

      const configured = settingsRes.data?.bacteriological_test_interval_days != null
      if (!configured) {
        setIsConfiguredState(false)
        setIntervalDays(DEFAULT_BACTERIOLOGICAL_INTERVAL_DAYS)
        setAlertEnabledState(DEFAULT_ALERT_ENABLED)
        useBacteriologicalTestStore.getState().setUnconfigured()
        return
      }

      const fetchedInterval     = settingsRes.data!.bacteriological_test_interval_days as number
      const fetchedAlertEnabled = (settingsRes.data?.bacteriological_test_alert_enabled as boolean | null | undefined)
        ?? DEFAULT_ALERT_ENABLED
      const fetchedLastAt       = (logsRes.data?.[0]?.tested_at as string | undefined) ?? null

      const MS_PER_DAY = 86_400_000
      let daysRem: number
      let computedZone: LabTestZone

      if (fetchedLastAt === null) {
        daysRem      = 0
        computedZone = 'red'
      } else {
        const lastPH       = toZonedTime(new Date(fetchedLastAt), PH_TZ)
        const lastMidnight = new Date(lastPH.getFullYear(), lastPH.getMonth(), lastPH.getDate())
        const nextDue      = new Date(lastMidnight.getTime() + fetchedInterval * MS_PER_DAY)
        daysRem            = Math.round((nextDue.getTime() - todayMidnight.getTime()) / MS_PER_DAY)
        computedZone       = computeLabTestZone(daysRem)
      }

      setLastTestedAt(fetchedLastAt)
      setDaysRemaining(daysRem)
      setCycleDays(fetchedInterval)
      setIntervalDays(fetchedInterval)
      setAlertEnabledState(fetchedAlertEnabled)
      setIsConfiguredState(true)
      setEventsTotal(totalRes.count ?? 0)
      setZone(computedZone)

      const store = useBacteriologicalTestStore.getState()
      store.setZone(computedZone)
      store.setAlertEnabled(fetchedAlertEnabled)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bacteriological test data')
    } finally {
      setIsLoading(false)
    }
  }, [stationId])

  useEffect(() => { void fetchData() }, [fetchData])

  const markAsCompleted = useCallback(async (notes?: string) => {
    if (!stationId) return
    const { error: e } = await supabase
      .from('bacteriological_test_logs')
      .insert({
        station_id: stationId,
        tested_at:  new Date().toISOString(),
        ...(notes ? { notes } : {}),
      })
    if (e) throw new Error(e.message)
    await fetchData()
  }, [stationId, fetchData])

  const updateSettings = useCallback(async (
    newIntervalDays: number,
    newAlertEnabled: boolean,
  ) => {
    if (!stationId) return
    const { error: e } = await supabase
      .from('station_settings')
      .upsert(
        {
          station_id:                          stationId,
          bacteriological_test_interval_days:  newIntervalDays,
          bacteriological_test_alert_enabled:  newAlertEnabled,
          updated_at:                          new Date().toISOString(),
        },
        { onConflict: 'station_id' },
      )
    if (e) throw new Error(e.message)
    await fetchData()
  }, [stationId, fetchData])

  return {
    lastTestedAt,
    daysRemaining,
    cycleDays,
    intervalDays,
    alertEnabled,
    isConfigured,
    eventsTotal,
    zone,
    isLoading,
    error,
    markAsCompleted,
    updateSettings,
  }
}

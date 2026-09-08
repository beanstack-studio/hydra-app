import { useState, useEffect, useCallback } from 'react'
import { toZonedTime } from 'date-fns-tz'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useBacteriologicalTestStore } from '@/stores/bacteriologicalTestStore'
import { PH_TZ } from '@/lib/utils'
import {
  computePeriodBasedTrackerState,
  makeCadenceConfig,
} from '../lib/cadenceUtils'
import type { CadenceConfig, ScheduleType, FrequencyCadence } from '../lib/cadenceUtils'

export { makeCadenceConfig }
export type { CadenceConfig }

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
  lastTestedAt:    string | null
  daysRemaining:   number
  cycleDays:       number
  cadenceConfig:   CadenceConfig
  alertEnabled:    boolean
  isConfigured:    boolean
  eventsTotal:     number
  zone:            LabTestZone
  isLoading:       boolean
  error:           string | null
  markAsCompleted: (notes?: string) => Promise<void>
  updateSettings:  (cadenceConfig: CadenceConfig, alertEnabled: boolean) => Promise<void>
}

export function useBacteriologicalTest(): UseBacteriologicalTestReturn {
  const stationId = useAuthStore((s) => s.stationId)

  const [lastTestedAt,  setLastTestedAt]  = useState<string | null>(null)
  const [daysRemaining, setDaysRemaining] = useState(0)
  const [cycleDays,     setCycleDays]     = useState(DEFAULT_BACTERIOLOGICAL_INTERVAL_DAYS)
  const [cadenceConfig, setCadenceConfig] = useState<CadenceConfig>(makeCadenceConfig(DEFAULT_BACTERIOLOGICAL_INTERVAL_DAYS))
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

      const thirteenMonthsAgo = new Date()
      thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13)

      const [logsRes, earliestRes, recentRes, totalRes, settingsRes] = await Promise.all([
        supabase
          .from('bacteriological_test_logs')
          .select('tested_at')
          .eq('station_id', stationId)
          .order('tested_at', { ascending: false })
          .limit(1),
        supabase
          .from('bacteriological_test_logs')
          .select('tested_at')
          .eq('station_id', stationId)
          .order('tested_at', { ascending: true })
          .limit(1),
        supabase
          .from('bacteriological_test_logs')
          .select('tested_at')
          .eq('station_id', stationId)
          .gte('tested_at', thirteenMonthsAgo.toISOString()),
        supabase
          .from('bacteriological_test_logs')
          .select('*', { count: 'exact', head: true })
          .eq('station_id', stationId),
        supabase
          .from('station_settings')
          .select(`
            bacteriological_test_interval_days,
            bacteriological_test_alert_enabled,
            bacteriological_test_schedule_type,
            bacteriological_test_due_day,
            bacteriological_test_due_week_number,
            bacteriological_test_due_weekday,
            bacteriological_test_frequency_cadence,
            bacteriological_test_frequency_interval_months
          `)
          .eq('station_id', stationId)
          .maybeSingle(),
      ])

      if (logsRes.error) throw new Error(logsRes.error.message)

      const scheduleType: ScheduleType =
        (settingsRes.data?.bacteriological_test_schedule_type as ScheduleType | null | undefined) ?? 'day_count'
      const configured =
        settingsRes.data?.bacteriological_test_interval_days != null ||
        scheduleType !== 'day_count'

      if (!configured) {
        setIsConfiguredState(false)
        setCadenceConfig(makeCadenceConfig(DEFAULT_BACTERIOLOGICAL_INTERVAL_DAYS))
        setAlertEnabledState(DEFAULT_ALERT_ENABLED)
        useBacteriologicalTestStore.getState().setUnconfigured()
        return
      }

      const fetchedAlertEnabled = (settingsRes.data?.bacteriological_test_alert_enabled as boolean | null | undefined)
        ?? DEFAULT_ALERT_ENABLED
      const fetchedLastAt     = (logsRes.data?.[0]?.tested_at as string | undefined) ?? null
      const fetchedEarliestAt = (earliestRes.data?.[0]?.tested_at as string | undefined) ?? null
      const fetchedRecentTs   = ((recentRes.data ?? []) as { tested_at: string }[]).map((r) => r.tested_at)

      const conf: CadenceConfig = {
        scheduleType,
        intervalDays:            (settingsRes.data?.bacteriological_test_interval_days as number | null | undefined) ?? DEFAULT_BACTERIOLOGICAL_INTERVAL_DAYS,
        dueDayOfMonth:           (settingsRes.data?.bacteriological_test_due_day as number | null | undefined) ?? 1,
        dueWeekNumber:           (settingsRes.data?.bacteriological_test_due_week_number as number | null | undefined) ?? 1,
        dueWeekday:              (settingsRes.data?.bacteriological_test_due_weekday as number | null | undefined) ?? 1,
        frequencyCadence:        (settingsRes.data?.bacteriological_test_frequency_cadence as FrequencyCadence | null | undefined) ?? 'monthly',
        frequencyIntervalMonths: (settingsRes.data?.bacteriological_test_frequency_interval_months as number | null | undefined) ?? 2,
      }

      const MS_PER_DAY = 86_400_000
      let daysRem: number
      let computedCycleDays: number
      let computedZone: LabTestZone

      if (scheduleType !== 'day_count') {
        const result = computePeriodBasedTrackerState({
          config:           conf,
          lastEventAt:      fetchedLastAt,
          earliestEventAt:  fetchedEarliestAt,
          recentTimestamps: fetchedRecentTs,
          todayPH:          phNow,
          phTz:             PH_TZ,
        })
        daysRem           = result.daysRemaining
        computedCycleDays = result.cycleDays
        computedZone      = result.zone
      } else {
        const fetchedInterval = conf.intervalDays
        if (fetchedLastAt === null) {
          daysRem           = 0
          computedCycleDays = fetchedInterval
          computedZone      = 'red'
        } else {
          const lastPH       = toZonedTime(new Date(fetchedLastAt), PH_TZ)
          const lastMidnight = new Date(lastPH.getFullYear(), lastPH.getMonth(), lastPH.getDate())
          const nextDue      = new Date(lastMidnight.getTime() + fetchedInterval * MS_PER_DAY)
          daysRem            = Math.round((nextDue.getTime() - todayMidnight.getTime()) / MS_PER_DAY)
          computedCycleDays  = fetchedInterval
          computedZone       = computeLabTestZone(daysRem)
        }
      }

      setLastTestedAt(fetchedLastAt)
      setDaysRemaining(daysRem)
      setCycleDays(computedCycleDays)
      setCadenceConfig(conf)
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
    newCadence:      CadenceConfig,
    newAlertEnabled: boolean,
  ) => {
    if (!stationId) return
    const { error: e } = await supabase
      .from('station_settings')
      .upsert(
        {
          station_id:                                          stationId,
          bacteriological_test_schedule_type:                  newCadence.scheduleType,
          bacteriological_test_interval_days:                  newCadence.scheduleType === 'day_count' ? newCadence.intervalDays : null,
          bacteriological_test_due_day:                        newCadence.scheduleType === 'date'      ? newCadence.dueDayOfMonth : null,
          bacteriological_test_due_week_number:                newCadence.scheduleType === 'weekday'   ? newCadence.dueWeekNumber : null,
          bacteriological_test_due_weekday:                    newCadence.scheduleType === 'weekday'   ? newCadence.dueWeekday    : null,
          bacteriological_test_frequency_cadence:              newCadence.scheduleType !== 'day_count' ? newCadence.frequencyCadence : null,
          bacteriological_test_frequency_interval_months:      newCadence.scheduleType !== 'day_count' && newCadence.frequencyCadence === 'custom' ? newCadence.frequencyIntervalMonths : null,
          bacteriological_test_alert_enabled:                  newAlertEnabled,
          updated_at:                                          new Date().toISOString(),
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
    cadenceConfig,
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

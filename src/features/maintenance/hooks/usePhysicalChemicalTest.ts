import { useState, useEffect, useCallback } from 'react'
import { toZonedTime } from 'date-fns-tz'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { usePhysicalChemicalTestStore } from '@/stores/physicalChemicalTestStore'
import { PH_TZ } from '@/lib/utils'
import {
  computePeriodBasedTrackerState,
  makeCadenceConfig,
} from '../lib/cadenceUtils'
import type { CadenceConfig, ScheduleType, FrequencyCadence } from '../lib/cadenceUtils'
import { computeLabTestZone } from './useBacteriologicalTest'
import type { LabTestZone } from './useBacteriologicalTest'

export { makeCadenceConfig }
export type { CadenceConfig }

export const DEFAULT_PHYSICAL_CHEMICAL_INTERVAL_DAYS = 180
const DEFAULT_ALERT_ENABLED = true

export interface UsePhysicalChemicalTestReturn {
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

export function usePhysicalChemicalTest(): UsePhysicalChemicalTestReturn {
  const stationId = useAuthStore((s) => s.stationId)

  const [lastTestedAt,  setLastTestedAt]  = useState<string | null>(null)
  const [daysRemaining, setDaysRemaining] = useState(0)
  const [cycleDays,     setCycleDays]     = useState(DEFAULT_PHYSICAL_CHEMICAL_INTERVAL_DAYS)
  const [cadenceConfig, setCadenceConfig] = useState<CadenceConfig>(makeCadenceConfig(DEFAULT_PHYSICAL_CHEMICAL_INTERVAL_DAYS))
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
          .from('physical_chemical_test_logs')
          .select('tested_at')
          .eq('station_id', stationId)
          .order('tested_at', { ascending: false })
          .limit(1),
        supabase
          .from('physical_chemical_test_logs')
          .select('tested_at')
          .eq('station_id', stationId)
          .order('tested_at', { ascending: true })
          .limit(1),
        supabase
          .from('physical_chemical_test_logs')
          .select('tested_at')
          .eq('station_id', stationId)
          .gte('tested_at', thirteenMonthsAgo.toISOString()),
        supabase
          .from('physical_chemical_test_logs')
          .select('*', { count: 'exact', head: true })
          .eq('station_id', stationId),
        supabase
          .from('station_settings')
          .select(`
            physical_chemical_test_interval_days,
            physical_chemical_test_alert_enabled,
            physical_chemical_test_schedule_type,
            physical_chemical_test_due_day,
            physical_chemical_test_due_week_number,
            physical_chemical_test_due_weekday,
            physical_chemical_test_frequency_cadence,
            physical_chemical_test_frequency_interval_months
          `)
          .eq('station_id', stationId)
          .maybeSingle(),
      ])

      if (logsRes.error) throw new Error(logsRes.error.message)

      const scheduleType: ScheduleType =
        (settingsRes.data?.physical_chemical_test_schedule_type as ScheduleType | null | undefined) ?? 'day_count'
      const configured =
        settingsRes.data?.physical_chemical_test_interval_days != null ||
        scheduleType !== 'day_count'

      if (!configured) {
        setIsConfiguredState(false)
        setCadenceConfig(makeCadenceConfig(DEFAULT_PHYSICAL_CHEMICAL_INTERVAL_DAYS))
        setAlertEnabledState(DEFAULT_ALERT_ENABLED)
        usePhysicalChemicalTestStore.getState().setUnconfigured()
        return
      }

      const fetchedAlertEnabled = (settingsRes.data?.physical_chemical_test_alert_enabled as boolean | null | undefined)
        ?? DEFAULT_ALERT_ENABLED
      const fetchedLastAt     = (logsRes.data?.[0]?.tested_at as string | undefined) ?? null
      const fetchedEarliestAt = (earliestRes.data?.[0]?.tested_at as string | undefined) ?? null
      const fetchedRecentTs   = ((recentRes.data ?? []) as { tested_at: string }[]).map((r) => r.tested_at)

      const conf: CadenceConfig = {
        scheduleType,
        intervalDays:            (settingsRes.data?.physical_chemical_test_interval_days as number | null | undefined) ?? DEFAULT_PHYSICAL_CHEMICAL_INTERVAL_DAYS,
        dueDayOfMonth:           (settingsRes.data?.physical_chemical_test_due_day as number | null | undefined) ?? 1,
        dueWeekNumber:           (settingsRes.data?.physical_chemical_test_due_week_number as number | null | undefined) ?? 1,
        dueWeekday:              (settingsRes.data?.physical_chemical_test_due_weekday as number | null | undefined) ?? 1,
        frequencyCadence:        (settingsRes.data?.physical_chemical_test_frequency_cadence as FrequencyCadence | null | undefined) ?? 'monthly',
        frequencyIntervalMonths: (settingsRes.data?.physical_chemical_test_frequency_interval_months as number | null | undefined) ?? 2,
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

      const store = usePhysicalChemicalTestStore.getState()
      store.setZone(computedZone)
      store.setAlertEnabled(fetchedAlertEnabled)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load physical/chemical test data')
    } finally {
      setIsLoading(false)
    }
  }, [stationId])

  useEffect(() => { void fetchData() }, [fetchData])

  const markAsCompleted = useCallback(async (notes?: string) => {
    if (!stationId) return
    const { error: e } = await supabase
      .from('physical_chemical_test_logs')
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
          station_id:                                           stationId,
          physical_chemical_test_schedule_type:                 newCadence.scheduleType,
          physical_chemical_test_interval_days:                 newCadence.scheduleType === 'day_count' ? newCadence.intervalDays : null,
          physical_chemical_test_due_day:                       newCadence.scheduleType === 'date'      ? newCadence.dueDayOfMonth : null,
          physical_chemical_test_due_week_number:               newCadence.scheduleType === 'weekday'   ? newCadence.dueWeekNumber : null,
          physical_chemical_test_due_weekday:                   newCadence.scheduleType === 'weekday'   ? newCadence.dueWeekday    : null,
          physical_chemical_test_frequency_cadence:             newCadence.scheduleType !== 'day_count' ? newCadence.frequencyCadence : null,
          physical_chemical_test_frequency_interval_months:     newCadence.scheduleType !== 'day_count' && newCadence.frequencyCadence === 'custom' ? newCadence.frequencyIntervalMonths : null,
          physical_chemical_test_alert_enabled:                 newAlertEnabled,
          updated_at:                                           new Date().toISOString(),
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

import { useState, useEffect, useCallback } from 'react'
import { toZonedTime } from 'date-fns-tz'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { usePhysicalChemicalTestStore } from '@/stores/physicalChemicalTestStore'
import { PH_TZ } from '@/lib/utils'
import { computeLabTestZone } from './useBacteriologicalTest'
import type { LabTestZone } from './useBacteriologicalTest'

export const DEFAULT_PHYSICAL_CHEMICAL_INTERVAL_DAYS = 180
const DEFAULT_ALERT_ENABLED = true

export interface UsePhysicalChemicalTestReturn {
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

export function usePhysicalChemicalTest(): UsePhysicalChemicalTestReturn {
  const stationId = useAuthStore((s) => s.stationId)

  const [lastTestedAt,  setLastTestedAt]  = useState<string | null>(null)
  const [daysRemaining, setDaysRemaining] = useState(0)
  const [cycleDays,     setCycleDays]     = useState(DEFAULT_PHYSICAL_CHEMICAL_INTERVAL_DAYS)
  const [intervalDays,  setIntervalDays]  = useState(DEFAULT_PHYSICAL_CHEMICAL_INTERVAL_DAYS)
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
          .from('physical_chemical_test_logs')
          .select('tested_at')
          .eq('station_id', stationId)
          .order('tested_at', { ascending: false })
          .limit(1),
        supabase
          .from('physical_chemical_test_logs')
          .select('*', { count: 'exact', head: true })
          .eq('station_id', stationId),
        supabase
          .from('station_settings')
          .select('physical_chemical_test_interval_days, physical_chemical_test_alert_enabled')
          .eq('station_id', stationId)
          .maybeSingle(),
      ])

      if (logsRes.error) throw new Error(logsRes.error.message)

      const configured = settingsRes.data?.physical_chemical_test_interval_days != null
      if (!configured) {
        setIsConfiguredState(false)
        setIntervalDays(DEFAULT_PHYSICAL_CHEMICAL_INTERVAL_DAYS)
        setAlertEnabledState(DEFAULT_ALERT_ENABLED)
        usePhysicalChemicalTestStore.getState().setUnconfigured()
        return
      }

      const fetchedInterval     = settingsRes.data!.physical_chemical_test_interval_days as number
      const fetchedAlertEnabled = (settingsRes.data?.physical_chemical_test_alert_enabled as boolean | null | undefined)
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
    newIntervalDays: number,
    newAlertEnabled: boolean,
  ) => {
    if (!stationId) return
    const { error: e } = await supabase
      .from('station_settings')
      .upsert(
        {
          station_id:                           stationId,
          physical_chemical_test_interval_days:  newIntervalDays,
          physical_chemical_test_alert_enabled:  newAlertEnabled,
          updated_at:                            new Date().toISOString(),
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

import { useState, useEffect, useCallback } from 'react'
import { toZonedTime } from 'date-fns-tz'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useFilterReplacementStore } from '@/stores/filterReplacementStore'
import { PH_TZ } from '@/lib/utils'
import {
  computePeriodBasedTrackerState,
  makeCadenceConfig,
} from '../lib/cadenceUtils'
import type { CadenceConfig, ScheduleType, FrequencyCadence } from '../lib/cadenceUtils'

// Re-export the canonical type so existing imports from this file still work
export type { FilterReplacementZone } from '@/stores/filterReplacementStore'
import type { FilterReplacementZone } from '@/stores/filterReplacementStore'

export { makeCadenceConfig }
export type { CadenceConfig }

export const DEFAULT_INTERVAL_DAYS = 30
const DEFAULT_FILTER_ALERT_ENABLED = true

// ── Zone thresholds ───────────────────────────────────────────────────────────
// daysRemaining > 5  → green
// daysRemaining 1–5  → yellow (warning window)
// daysRemaining ≤ 0  → red (due today or overdue)

export function computeFilterReplacementZone(daysRemaining: number): FilterReplacementZone {
  if (daysRemaining <= 0) return 'red'
  if (daysRemaining <= 5) return 'yellow'
  return 'green'
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SupplyOption {
  id: string
  name: string
}

// One supply→qty pair for the replacement cycle setting.
export interface FilterReplacementSupplyLink {
  supply_id: string
  qty: number
}

export interface UseFilterReplacementReturn {
  lastReplacedAt:  string | null
  nextDueDate:     Date | null
  daysElapsed:     number
  daysRemaining:   number
  cycleDays:       number
  cadenceConfig:   CadenceConfig
  alertEnabled:    boolean
  isConfigured:    boolean
  replacementsYtd: number
  linkedSupplies:  FilterReplacementSupplyLink[]
  supplies:        SupplyOption[]
  zone:            FilterReplacementZone
  isLoading:       boolean
  error:           string | null
  markAsReplaced:  (notes?: string) => Promise<void>
  updateSettings:  (cadenceConfig: CadenceConfig, supplies: FilterReplacementSupplyLink[], alertEnabled: boolean) => Promise<void>
}

export function useFilterReplacement(): UseFilterReplacementReturn {
  const stationId = useAuthStore((s) => s.stationId)

  const [lastReplacedAt,  setLastReplacedAt]  = useState<string | null>(null)
  const [nextDueDate,     setNextDueDate]      = useState<Date | null>(null)
  const [daysElapsed,     setDaysElapsed]      = useState(0)
  const [daysRemaining,   setDaysRemaining]    = useState(0)
  const [cycleDays,       setCycleDays]        = useState(DEFAULT_INTERVAL_DAYS)
  const [cadenceConfig,   setCadenceConfig]    = useState<CadenceConfig>(makeCadenceConfig(DEFAULT_INTERVAL_DAYS))
  const [alertEnabled,    setAlertEnabledState] = useState(DEFAULT_FILTER_ALERT_ENABLED)
  const [isConfigured,    setIsConfiguredState] = useState(false)
  const [replacementsYtd, setReplacementsYtd]  = useState(0)
  const [supplies,        setSupplies]         = useState<SupplyOption[]>([])
  const [linkedSupplies,  setLinkedSupplies]   = useState<FilterReplacementSupplyLink[]>([])
  const [zone,            setZone]             = useState<FilterReplacementZone>('red')
  const [isLoading,       setIsLoading]        = useState(true)
  const [error,           setError]            = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) { setIsLoading(false); return }
    setError(null)
    try {
      const phNow         = toZonedTime(new Date(), PH_TZ)
      const todayMidnight = new Date(phNow.getFullYear(), phNow.getMonth(), phNow.getDate())

      // "13 months ago" gives us a safe buffer for PH timezone boundary cases
      const thirteenMonthsAgo = new Date()
      thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13)

      const [logsRes, earliestRes, recentRes, ytdRes, settingsRes, suppliesRes] = await Promise.all([
        supabase
          .from('filter_replacement_logs')
          .select('replaced_at')
          .eq('station_id', stationId)
          .order('replaced_at', { ascending: false })
          .limit(1),
        supabase
          .from('filter_replacement_logs')
          .select('replaced_at')
          .eq('station_id', stationId)
          .order('replaced_at', { ascending: true })
          .limit(1),
        supabase
          .from('filter_replacement_logs')
          .select('replaced_at')
          .eq('station_id', stationId)
          .gte('replaced_at', thirteenMonthsAgo.toISOString()),
        supabase
          .from('filter_replacement_logs')
          .select('*', { count: 'exact', head: true })
          .eq('station_id', stationId),
        supabase
          .from('station_settings')
          .select(`
            filter_replacement_interval_days,
            filter_replacement_alert_enabled,
            filter_replacement_supply_id,
            filter_replacement_supply_qty,
            filter_replacement_schedule_type,
            filter_replacement_due_day,
            filter_replacement_due_week_number,
            filter_replacement_due_weekday,
            filter_replacement_frequency_cadence,
            filter_replacement_frequency_interval_months
          `)
          .eq('station_id', stationId)
          .maybeSingle(),
        supabase
          .from('supplies')
          .select('id, name')
          .eq('station_id', stationId)
          .order('name'),
      ])

      if (logsRes.error) throw new Error(logsRes.error.message)

      // Read supply options regardless of configuration (needed for the modal)
      const legacyId  = (settingsRes.data?.filter_replacement_supply_id as string | null | undefined) ?? null
      const legacyQty = (settingsRes.data?.filter_replacement_supply_qty as number | null | undefined) ?? 1
      const fetchedSupplies: FilterReplacementSupplyLink[] = legacyId
        ? [{ supply_id: legacyId, qty: legacyQty }]
        : []
      setSupplies((suppliesRes.data ?? []) as SupplyOption[])
      setLinkedSupplies(fetchedSupplies)

      // ── Configured check ──────────────────────────────────────────────────
      const scheduleType: ScheduleType =
        (settingsRes.data?.filter_replacement_schedule_type as ScheduleType | null | undefined) ?? 'day_count'
      const configured =
        settingsRes.data?.filter_replacement_interval_days != null ||
        scheduleType !== 'day_count'

      if (!configured) {
        setIsConfiguredState(false)
        setCadenceConfig(makeCadenceConfig(DEFAULT_INTERVAL_DAYS))
        setAlertEnabledState(DEFAULT_FILTER_ALERT_ENABLED)
        useFilterReplacementStore.getState().setUnconfigured()
        return
      }

      const fetchedAlertEnabled = (settingsRes.data?.filter_replacement_alert_enabled as boolean | null | undefined)
        ?? DEFAULT_FILTER_ALERT_ENABLED
      const fetchedLastAt       = (logsRes.data?.[0]?.replaced_at as string | undefined) ?? null
      const fetchedEarliestAt   = (earliestRes.data?.[0]?.replaced_at as string | undefined) ?? null
      const fetchedRecentTs     = ((recentRes.data ?? []) as { replaced_at: string }[]).map((r) => r.replaced_at)

      // Build CadenceConfig from DB values
      const conf: CadenceConfig = {
        scheduleType,
        intervalDays:            (settingsRes.data?.filter_replacement_interval_days as number | null | undefined) ?? DEFAULT_INTERVAL_DAYS,
        dueDayOfMonth:           (settingsRes.data?.filter_replacement_due_day as number | null | undefined) ?? 1,
        dueWeekNumber:           (settingsRes.data?.filter_replacement_due_week_number as number | null | undefined) ?? 1,
        dueWeekday:              (settingsRes.data?.filter_replacement_due_weekday as number | null | undefined) ?? 1,
        frequencyCadence:        (settingsRes.data?.filter_replacement_frequency_cadence as FrequencyCadence | null | undefined) ?? 'monthly',
        frequencyIntervalMonths: (settingsRes.data?.filter_replacement_frequency_interval_months as number | null | undefined) ?? 2,
      }

      const MS_PER_DAY = 86_400_000
      let daysRem: number
      let computedCycleDays: number
      let computedZone: FilterReplacementZone
      let nextDue: Date | null = null
      let elapsed = 0

      if (scheduleType !== 'day_count') {
        // Period-bucket model (Date / Weekday)
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
        // Day Count — interval-based arithmetic
        const fetchedInterval = conf.intervalDays
        if (fetchedLastAt === null) {
          nextDue           = todayMidnight
          elapsed           = 0
          daysRem           = 0
          computedCycleDays = fetchedInterval
          computedZone      = 'red'
        } else {
          const lastPH       = toZonedTime(new Date(fetchedLastAt), PH_TZ)
          const lastMidnight = new Date(lastPH.getFullYear(), lastPH.getMonth(), lastPH.getDate())
          nextDue            = new Date(lastMidnight.getTime() + fetchedInterval * MS_PER_DAY)
          elapsed            = Math.max(0, Math.round((todayMidnight.getTime() - lastMidnight.getTime()) / MS_PER_DAY))
          daysRem            = Math.round((nextDue.getTime() - todayMidnight.getTime()) / MS_PER_DAY)
          computedCycleDays  = fetchedInterval
          computedZone       = computeFilterReplacementZone(daysRem)
        }
      }

      setLastReplacedAt(fetchedLastAt)
      setNextDueDate(nextDue)
      setDaysElapsed(elapsed)
      setDaysRemaining(daysRem)
      setCycleDays(computedCycleDays)
      setCadenceConfig(conf)
      setAlertEnabledState(fetchedAlertEnabled)
      setIsConfiguredState(true)
      setReplacementsYtd(ytdRes.count ?? 0)
      setZone(computedZone)

      // Push to global store so Sidebar badge and login alert can read zone/alertEnabled/isConfigured
      // regardless of whether FilterReplacementCard is mounted.
      const store = useFilterReplacementStore.getState()
      store.setZone(computedZone)
      store.setAlertEnabled(fetchedAlertEnabled)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load filter replacement data')
    } finally {
      setIsLoading(false)
    }
  }, [stationId])

  useEffect(() => { void fetchData() }, [fetchData])

  const markAsReplaced = useCallback(async (notes?: string) => {
    if (!stationId) return

    // Deduct all linked supplies sequentially
    type SupplyDeduction = { supply_id: string; qty_deducted: number }
    const deductions: SupplyDeduction[] = []

    for (const link of linkedSupplies) {
      const { data: supplyRow } = await supabase
        .from('supplies')
        .select('qty')
        .eq('id', link.supply_id)
        .eq('station_id', stationId)
        .maybeSingle()

      if (supplyRow) {
        const currentQty = (supplyRow as { qty: number }).qty
        const newQty     = Math.max(0, currentQty - link.qty)
        await supabase.from('supplies').update({ qty: newQty }).eq('id', link.supply_id)
        deductions.push({ supply_id: link.supply_id, qty_deducted: link.qty })
      }
    }

    const firstDeduction = deductions[0] ?? null
    const { error: e } = await supabase
      .from('filter_replacement_logs')
      .insert({
        station_id:  stationId,
        replaced_at: new Date().toISOString(),
        ...(notes ? { notes } : {}),
        ...(firstDeduction
          ? { linked_supply_id: firstDeduction.supply_id, qty_deducted: firstDeduction.qty_deducted }
          : {}),
      })
    if (e) throw new Error(e.message)
    await fetchData()
  }, [stationId, fetchData, linkedSupplies])

  const updateSettings = useCallback(async (
    newCadence:     CadenceConfig,
    newSupplies:    FilterReplacementSupplyLink[],
    newAlertEnabled: boolean,
  ) => {
    if (!stationId) return
    const firstLink = newSupplies[0] ?? null
    const { error: e } = await supabase
      .from('station_settings')
      .upsert(
        {
          station_id:                                        stationId,
          filter_replacement_schedule_type:                  newCadence.scheduleType,
          filter_replacement_interval_days:                  newCadence.scheduleType === 'day_count' ? newCadence.intervalDays : null,
          filter_replacement_due_day:                        newCadence.scheduleType === 'date'      ? newCadence.dueDayOfMonth : null,
          filter_replacement_due_week_number:                newCadence.scheduleType === 'weekday'   ? newCadence.dueWeekNumber : null,
          filter_replacement_due_weekday:                    newCadence.scheduleType === 'weekday'   ? newCadence.dueWeekday    : null,
          filter_replacement_frequency_cadence:              newCadence.scheduleType !== 'day_count' ? newCadence.frequencyCadence : null,
          filter_replacement_frequency_interval_months:      newCadence.scheduleType !== 'day_count' && newCadence.frequencyCadence === 'custom' ? newCadence.frequencyIntervalMonths : null,
          filter_replacement_alert_enabled:                  newAlertEnabled,
          filter_replacement_supply_id:                      firstLink?.supply_id ?? null,
          filter_replacement_supply_qty:                     firstLink?.qty       ?? null,
          updated_at:                                        new Date().toISOString(),
        },
        { onConflict: 'station_id' }
      )
    if (e) throw new Error(e.message)
    await fetchData()
  }, [stationId, fetchData])

  return {
    lastReplacedAt,
    nextDueDate,
    daysElapsed,
    daysRemaining,
    cycleDays,
    cadenceConfig,
    alertEnabled,
    isConfigured,
    replacementsYtd,
    linkedSupplies,
    supplies,
    zone,
    isLoading,
    error,
    markAsReplaced,
    updateSettings,
  }
}

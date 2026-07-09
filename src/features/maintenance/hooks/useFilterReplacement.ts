import { useState, useEffect, useCallback } from 'react'
import { toZonedTime } from 'date-fns-tz'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { PH_TZ } from '@/lib/utils'

export type FilterReplacementZone = 'green' | 'yellow' | 'red'

export const DEFAULT_REPLACEMENT_DAY = 1

// ── Day-of-month clamping ─────────────────────────────────────────────────────
//
// Uses the JS idiom `new Date(year, month + 1, 0).getDate()`:
//   "day 0 of the next month" = last day of the current month.
//
// Clamping is recalculated fresh each month — storing day 31 always keeps the
// intent; Feb reverts to 28/29, then March correctly returns to 31.

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function clampReplacementDay(desiredDay: number, year: number, month: number): number {
  return Math.min(desiredDay, lastDayOfMonth(year, month))
}

// Returns the first scheduled replacement Date (local midnight) STRICTLY AFTER
// afterDate. Checks this month first, falls back to next month.
export function getNextDueAfter(replacementDay: number, afterDate: Date): Date {
  const year  = afterDate.getFullYear()
  const month = afterDate.getMonth()

  const thisMonthClamped = clampReplacementDay(replacementDay, year, month)
  const thisMonthDue     = new Date(year, month, thisMonthClamped)

  if (thisMonthDue > afterDate) return thisMonthDue

  const nextMonth = (month + 1) % 12
  const nextYear  = month === 11 ? year + 1 : year
  return new Date(nextYear, nextMonth, clampReplacementDay(replacementDay, nextYear, nextMonth))
}

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
// NOTE: multi-supply JSONB persistence (migration 20260708000005) is pending
// a `supabase db push`. Until applied, only the first entry is stored in the
// legacy single-column pair (filter_replacement_supply_id / _qty).
export interface FilterReplacementSupplyLink {
  supply_id: string
  qty: number
}

export interface UseFilterReplacementReturn {
  lastReplacedAt: string | null
  nextDueDate: Date | null
  daysElapsed: number
  daysRemaining: number
  cycleDays: number
  replacementDay: number
  replacementsYtd: number
  linkedSupplies: FilterReplacementSupplyLink[]
  supplies: SupplyOption[]
  zone: FilterReplacementZone
  isLoading: boolean
  error: string | null
  markAsReplaced: () => Promise<void>
  updateSettings: (day: number, supplies: FilterReplacementSupplyLink[]) => Promise<void>
}

export function useFilterReplacement(): UseFilterReplacementReturn {
  const stationId = useAuthStore((s) => s.stationId)

  const [lastReplacedAt,  setLastReplacedAt]  = useState<string | null>(null)
  const [nextDueDate,     setNextDueDate]     = useState<Date | null>(null)
  const [daysElapsed,     setDaysElapsed]     = useState(0)
  const [daysRemaining,   setDaysRemaining]   = useState(0)
  const [cycleDays,       setCycleDays]       = useState(30)
  const [replacementDay,  setReplacementDay]  = useState(DEFAULT_REPLACEMENT_DAY)
  const [replacementsYtd, setReplacementsYtd] = useState(0)
  const [supplies,        setSupplies]        = useState<SupplyOption[]>([])
  const [linkedSupplies,  setLinkedSupplies]  = useState<FilterReplacementSupplyLink[]>([])
  const [zone,            setZone]            = useState<FilterReplacementZone>('red')
  const [isLoading,       setIsLoading]       = useState(true)
  const [error,           setError]           = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) { setIsLoading(false); return }
    setError(null)
    try {
      const phNow         = toZonedTime(new Date(), PH_TZ)
      const ytdStartTz    = `${phNow.getFullYear()}-01-01T00:00:00+08:00`
      const todayMidnight = new Date(phNow.getFullYear(), phNow.getMonth(), phNow.getDate())

      const [logsRes, ytdRes, settingsRes, suppliesRes] = await Promise.all([
        supabase
          .from('filter_replacement_logs')
          .select('replaced_at')
          .eq('station_id', stationId)
          .order('replaced_at', { ascending: false })
          .limit(1),
        supabase
          .from('filter_replacement_logs')
          .select('*', { count: 'exact', head: true })
          .eq('station_id', stationId)
          .gte('replaced_at', ytdStartTz),
        // Only select columns that exist in the current schema.
        // filter_replacement_supplies (JSONB) requires migration 20260708000005.
        supabase
          .from('station_settings')
          .select('filter_replacement_day, filter_replacement_supply_id, filter_replacement_supply_qty')
          .eq('station_id', stationId)
          .maybeSingle(),
        supabase
          .from('supplies')
          .select('id, name')
          .eq('station_id', stationId)
          .order('name'),
      ])

      if (logsRes.error) throw new Error(logsRes.error.message)
      // settingsRes failure is non-fatal — fall back to defaults

      const fetchedDay    = settingsRes.data?.filter_replacement_day ?? DEFAULT_REPLACEMENT_DAY
      const fetchedLastAt = (logsRes.data?.[0]?.replaced_at as string | undefined) ?? null

      // Read linked supply from legacy single columns.
      // Once migration 20260708000005 is applied, switch to reading filter_replacement_supplies JSONB.
      const legacyId  = (settingsRes.data?.filter_replacement_supply_id as string | null | undefined) ?? null
      const legacyQty = (settingsRes.data?.filter_replacement_supply_qty as number | null | undefined) ?? 1
      const fetchedSupplies: FilterReplacementSupplyLink[] = legacyId
        ? [{ supply_id: legacyId, qty: legacyQty }]
        : []

      // ── Day arithmetic in PHT ─────────────────────────────────────────────
      const MS_PER_DAY = 86_400_000

      let nextDue: Date
      let elapsed: number
      let daysRem: number
      let cycle: number
      let computedZone: FilterReplacementZone

      if (fetchedLastAt === null) {
        const justBeforeToday = new Date(todayMidnight.getTime() - 1)
        nextDue      = getNextDueAfter(fetchedDay, justBeforeToday)
        elapsed      = 0
        daysRem      = 0
        cycle        = 30
        computedZone = 'red'
      } else {
        const lastPH       = toZonedTime(new Date(fetchedLastAt), PH_TZ)
        const lastMidnight = new Date(lastPH.getFullYear(), lastPH.getMonth(), lastPH.getDate())

        nextDue  = getNextDueAfter(fetchedDay, lastMidnight)
        elapsed  = Math.max(0, Math.round((todayMidnight.getTime() - lastMidnight.getTime()) / MS_PER_DAY))
        cycle    = Math.max(1, Math.round((nextDue.getTime()       - lastMidnight.getTime()) / MS_PER_DAY))
        daysRem  = Math.round((nextDue.getTime() - todayMidnight.getTime()) / MS_PER_DAY)
        computedZone = computeFilterReplacementZone(daysRem)
      }

      setLastReplacedAt(fetchedLastAt)
      setNextDueDate(nextDue)
      setDaysElapsed(elapsed)
      setDaysRemaining(daysRem)
      setCycleDays(cycle)
      setReplacementDay(fetchedDay)
      setReplacementsYtd(ytdRes.count ?? 0)
      setSupplies((suppliesRes.data ?? []) as SupplyOption[])
      setLinkedSupplies(fetchedSupplies)
      setZone(computedZone)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load filter replacement data')
    } finally {
      setIsLoading(false)
    }
  }, [stationId])

  useEffect(() => { void fetchData() }, [fetchData])

  const markAsReplaced = useCallback(async () => {
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
    // supply_deductions JSONB column requires migration 20260708000005.
    // Writing to legacy single columns until that migration is applied.
    const { error: e } = await supabase
      .from('filter_replacement_logs')
      .insert({
        station_id:  stationId,
        replaced_at: new Date().toISOString(),
        ...(firstDeduction
          ? { linked_supply_id: firstDeduction.supply_id, qty_deducted: firstDeduction.qty_deducted }
          : {}),
      })
    if (e) throw new Error(e.message)
    await fetchData()
  }, [stationId, fetchData, linkedSupplies])

  const updateSettings = useCallback(async (day: number, newSupplies: FilterReplacementSupplyLink[]) => {
    if (!stationId) return
    const firstLink = newSupplies[0] ?? null
    // filter_replacement_supplies JSONB column requires migration 20260708000005.
    // Writing to legacy single columns until that migration is applied.
    const { error: e } = await supabase
      .from('station_settings')
      .upsert(
        {
          station_id:                    stationId,
          filter_replacement_day:        day,
          filter_replacement_supply_id:  firstLink?.supply_id ?? null,
          filter_replacement_supply_qty: firstLink?.qty       ?? null,
          updated_at:                    new Date().toISOString(),
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
    replacementDay,
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

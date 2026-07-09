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
// Verified against Task 2 spec (day 31 across key months):
//   clampReplacementDay(31, 2026, 0)  → Jan 2026 has 31 d → returns 31  ✓
//   clampReplacementDay(31, 2026, 1)  → Feb 2026 has 28 d → returns 28  ✓ (non-leap)
//   clampReplacementDay(31, 2024, 1)  → Feb 2024 has 29 d → returns 29  ✓ (leap)
//   clampReplacementDay(31, 2026, 3)  → Apr 2026 has 30 d → returns 30  ✓
//   clampReplacementDay(31, 2026, 11) → Dec 2026 has 31 d → returns 31  ✓
//
// Clamping is recalculated fresh each month — storing day 31 always keeps the
// intent; Feb reverts to 28/29, then March correctly returns to 31.

export function lastDayOfMonth(year: number, month: number): number {
  // month is 0-based (Jan=0, Dec=11)
  return new Date(year, month + 1, 0).getDate()
}

export function clampReplacementDay(
  desiredDay: number,
  year: number,
  month: number  // 0-based
): number {
  return Math.min(desiredDay, lastDayOfMonth(year, month))
}

// Returns the first scheduled replacement Date (local midnight) STRICTLY AFTER
// afterDate. Checks this month first, falls back to next month.
// Both input and output are in local-midnight format for day-diff arithmetic.
export function getNextDueAfter(
  replacementDay: number,
  afterDate: Date
): Date {
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
// daysRemaining > 5  → green (comfortably before due date)
// daysRemaining 1–5  → yellow (last 5 days)
// daysRemaining ≤ 0  → red (due today or overdue)

export function computeFilterReplacementZone(daysRemaining: number): FilterReplacementZone {
  if (daysRemaining <= 0) return 'red'
  if (daysRemaining <= 5) return 'yellow'
  return 'green'
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface UseFilterReplacementReturn {
  lastReplacedAt: string | null
  nextDueDate: Date | null
  daysElapsed: number
  cycleDays: number
  replacementDay: number
  zone: FilterReplacementZone
  isLoading: boolean
  error: string | null
  markAsReplaced: () => Promise<void>
  updateReplacementDay: (day: number) => Promise<void>
}

export function useFilterReplacement(): UseFilterReplacementReturn {
  const stationId = useAuthStore((s) => s.stationId)

  const [lastReplacedAt, setLastReplacedAt] = useState<string | null>(null)
  const [nextDueDate,    setNextDueDate]    = useState<Date | null>(null)
  const [daysElapsed,    setDaysElapsed]    = useState(0)
  const [cycleDays,      setCycleDays]      = useState(30)
  const [replacementDay, setReplacementDay] = useState(DEFAULT_REPLACEMENT_DAY)
  const [zone,           setZone]           = useState<FilterReplacementZone>('red')
  const [isLoading,      setIsLoading]      = useState(true)
  const [error,          setError]          = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) { setIsLoading(false); return }
    setError(null)
    try {
      const [logsRes, settingsRes] = await Promise.all([
        supabase
          .from('filter_replacement_logs')
          .select('replaced_at')
          .eq('station_id', stationId)
          .order('replaced_at', { ascending: false })
          .limit(1),
        supabase
          .from('station_settings')
          .select('filter_replacement_day')
          .eq('station_id', stationId)
          .maybeSingle(),
      ])

      if (logsRes.error) throw new Error(logsRes.error.message)
      // settingsRes failure is non-fatal — fall back to default

      const fetchedDay   = settingsRes.data?.filter_replacement_day ?? DEFAULT_REPLACEMENT_DAY
      const fetchedLastAt = (logsRes.data?.[0]?.replaced_at as string | undefined) ?? null

      // ── Day arithmetic in PHT ─────────────────────────────────────────────
      // toZonedTime returns a Date whose .getFullYear()/.getMonth()/.getDate()
      // reflect PHT values. We then build local-midnight Dates using those
      // PHT components so that subtraction gives correct PHT day counts.
      const phNow       = toZonedTime(new Date(), PH_TZ)
      const todayMidnight = new Date(phNow.getFullYear(), phNow.getMonth(), phNow.getDate())

      const MS_PER_DAY = 86_400_000

      let nextDue: Date
      let elapsed: number
      let cycle: number
      let computedZone: FilterReplacementZone

      if (fetchedLastAt === null) {
        // Never replaced — always overdue; compute next due from "just before today"
        const justBeforeToday = new Date(todayMidnight.getTime() - 1)
        nextDue      = getNextDueAfter(fetchedDay, justBeforeToday)
        elapsed      = 0
        cycle        = 30
        computedZone = 'red'
      } else {
        const lastPH      = toZonedTime(new Date(fetchedLastAt), PH_TZ)
        const lastMidnight = new Date(lastPH.getFullYear(), lastPH.getMonth(), lastPH.getDate())

        nextDue  = getNextDueAfter(fetchedDay, lastMidnight)
        elapsed  = Math.max(0, Math.round((todayMidnight.getTime() - lastMidnight.getTime()) / MS_PER_DAY))
        cycle    = Math.max(1, Math.round((nextDue.getTime()       - lastMidnight.getTime()) / MS_PER_DAY))

        const daysRemaining = Math.round((nextDue.getTime() - todayMidnight.getTime()) / MS_PER_DAY)
        computedZone = computeFilterReplacementZone(daysRemaining)
      }

      setLastReplacedAt(fetchedLastAt)
      setNextDueDate(nextDue)
      setDaysElapsed(elapsed)
      setCycleDays(cycle)
      setReplacementDay(fetchedDay)
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
    const { error: e } = await supabase
      .from('filter_replacement_logs')
      .insert({ station_id: stationId, replaced_at: new Date().toISOString() })
    if (e) throw new Error(e.message)
    await fetchData()
  }, [stationId, fetchData])

  const updateReplacementDay = useCallback(async (day: number) => {
    if (!stationId) return
    const { error: e } = await supabase
      .from('station_settings')
      .upsert(
        { station_id: stationId, filter_replacement_day: day, updated_at: new Date().toISOString() },
        { onConflict: 'station_id' }
      )
    if (e) throw new Error(e.message)
    // Refetch so all derived values (nextDueDate, daysElapsed, cycleDays, zone) recompute
    await fetchData()
  }, [stationId, fetchData])

  return {
    lastReplacedAt,
    nextDueDate,
    daysElapsed,
    cycleDays,
    replacementDay,
    zone,
    isLoading,
    error,
    markAsReplaced,
    updateReplacementDay,
  }
}

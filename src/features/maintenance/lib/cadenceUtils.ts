/**
 * Pure computation utilities for configurable maintenance tracker cadence.
 *
 * Three schedule types per tracker:
 *   'day_count' — N days after the last logged event (existing behaviour)
 *   'date'      — specific day-of-month, recurring on a monthly/quarterly/custom schedule
 *   'weekday'   — Nth weekday of a month, same recurrence options
 *
 * The period-bucket model mirrors Bills' isCurrentMonthDue/anchor pattern:
 *   1. Derive anchor from the earliest logged event (or current month if none).
 *   2. Determine whether the current calendar month is a "due month" for the cadence.
 *   3. If yes, compute the specific target date (day or weekday) for this month.
 *   4. Check whether an event has already been logged in the current due month.
 *   5. Return { daysRemaining, cycleDays, zone } in the same shape as day_count so
 *      IntervalTrackerCard needs no changes.
 */

import { toZonedTime } from 'date-fns-tz'

// ── Public types ──────────────────────────────────────────────────────────────

export type ScheduleType    = 'day_count' | 'date' | 'weekday'
export type FrequencyCadence = 'monthly' | 'quarterly' | 'custom'
export type TrackerZone      = 'green' | 'yellow' | 'red'

export interface CadenceConfig {
  scheduleType:             ScheduleType
  // day_count:
  intervalDays:             number          // days after last event; default 30
  // date:
  dueDayOfMonth:            number          // 1–31, default 1
  // weekday:
  dueWeekNumber:            number          // 1=first 2=second 3=third 4=fourth 5=last
  dueWeekday:               number          // 0=Sun … 6=Sat, default 1 (Mon)
  // date + weekday:
  frequencyCadence:         FrequencyCadence
  frequencyIntervalMonths:  number          // used when cadence = 'custom', default 2
}

/** Returns a CadenceConfig with 'day_count' defaults, overriding intervalDays. */
export function makeCadenceConfig(intervalDays: number): CadenceConfig {
  return {
    scheduleType:            'day_count',
    intervalDays,
    dueDayOfMonth:           1,
    dueWeekNumber:           1,
    dueWeekday:              1,
    frequencyCadence:        'monthly',
    frequencyIntervalMonths: 2,
  }
}

// ── Period-bucket helpers ─────────────────────────────────────────────────────

/**
 * Returns true if (currentYear, currentMonth) is a scheduled due month.
 * - 'monthly'  → always
 * - 'quarterly'→ every 3 months from the anchor
 * - 'custom'   → every intervalMonths months from the anchor
 *
 * Mirrors recurringAlerts.ts isCurrentMonthDue exactly.
 * Months are 1-based throughout.
 */
export function isCurrentPeriodDue(
  cadence:        FrequencyCadence,
  intervalMonths: number,
  anchorYear:     number,
  anchorMonth:    number,   // 1-based
  currentYear:    number,
  currentMonth:   number,   // 1-based
): boolean {
  if (cadence === 'monthly') return true
  const interval = cadence === 'quarterly' ? 3 : Math.max(1, intervalMonths)
  const elapsed  = (currentYear - anchorYear) * 12 + (currentMonth - anchorMonth)
  return elapsed > 0 && elapsed % interval === 0
}

/**
 * Returns the Date for the Nth weekday of the given month.
 * weekNumber: 1=first, 2=second, 3=third, 4=fourth, 5=last
 * weekday:    0=Sun … 6=Sat
 * month0:     0-based JS month
 */
export function computeNthWeekday(
  year:       number,
  month0:     number,
  weekNumber: number,
  weekday:    number,
): Date {
  if (weekNumber === 5) {
    // "last" weekday of month — scan backwards from last day
    const lastDay = new Date(year, month0 + 1, 0).getDate()
    for (let d = lastDay; d >= 1; d--) {
      const date = new Date(year, month0, d)
      if (date.getDay() === weekday) return date
    }
  }
  // Nth occurrence — scan forward
  let count = 0
  for (let d = 1; d <= 31; d++) {
    const date = new Date(year, month0, d)
    if (date.getMonth() !== month0) break   // past end of month
    if (date.getDay() === weekday) {
      count++
      if (count === weekNumber) return date
    }
  }
  // Fallback (unreachable for valid inputs 1-4)
  return new Date(year, month0, 1)
}

/**
 * Computes the specific due Date for (year, month0) given the config.
 * Clamps day-of-month to the last valid day of the month.
 */
export function computeDueDateForMonth(
  config: CadenceConfig,
  year:   number,
  month0: number,         // 0-based
): Date {
  if (config.scheduleType === 'date') {
    const lastDay = new Date(year, month0 + 1, 0).getDate()
    const day     = Math.min(config.dueDayOfMonth, lastDay)
    return new Date(year, month0, day)
  }
  // 'weekday'
  return computeNthWeekday(year, month0, config.dueWeekNumber, config.dueWeekday)
}

/**
 * Returns the length of the period starting at (year, month0) in whole days.
 * Monthly → days in that calendar month.
 * Quarterly → days in the three-month block.
 * Custom → days in intervalMonths months.
 */
export function computePeriodDays(
  cadence:        FrequencyCadence,
  intervalMonths: number,
  year:           number,
  month0:         number,   // 0-based
): number {
  const months = cadence === 'monthly'   ? 1
               : cadence === 'quarterly' ? 3
               : Math.max(1, intervalMonths)
  const start = new Date(year, month0, 1)
  const end   = new Date(year, month0 + months, 1)
  return Math.round((end.getTime() - start.getTime()) / 86_400_000)
}

/**
 * Returns the next calendar month after (fromYear, fromMonth) where
 * isCurrentPeriodDue is true.  Months are 1-based.
 */
export function findNextDueMonth(
  cadence:        FrequencyCadence,
  intervalMonths: number,
  anchorYear:     number,
  anchorMonth:    number,   // 1-based
  fromYear:       number,
  fromMonth:      number,   // 1-based
): { year: number; month: number } {
  let y = fromYear
  let m = fromMonth
  for (let i = 0; i < 120; i++) {   // cap at 10 years look-ahead
    m++
    if (m > 12) { m = 1; y++ }
    if (isCurrentPeriodDue(cadence, intervalMonths, anchorYear, anchorMonth, y, m)) {
      return { year: y, month: m }
    }
  }
  // Fallback — shouldn't be reached for valid cadences
  return { year: fromYear + 1, month: anchorMonth }
}

/**
 * Returns true if any of the provided ISO timestamps falls within the
 * given calendar month (year + 1-based month) when viewed in phTz.
 */
export function hasEventInMonth(
  timestamps: string[],
  year:       number,
  month:      number,   // 1-based
  phTz:       string,
): boolean {
  return timestamps.some((ts) => {
    const d = toZonedTime(new Date(ts), phTz)
    return d.getFullYear() === year && d.getMonth() + 1 === month
  })
}

// ── Main computation ──────────────────────────────────────────────────────────

export interface PeriodBasedResult {
  daysRemaining: number
  cycleDays:     number
  zone:          TrackerZone
}

/**
 * Computes { daysRemaining, cycleDays, zone } for a 'date' or 'weekday' tracker.
 *
 * The returned values are drop-in replacements for the day_count equivalents:
 *   daysRemaining > 5  → green  (within-period, far from due date, or period done)
 *   daysRemaining 1–5  → yellow (approaching due date)
 *   daysRemaining ≤ 0  → red    (due date passed without a logged event)
 *
 * @param config               Cadence configuration (must be 'date' or 'weekday')
 * @param lastEventAt          ISO string of the most recent logged event, or null
 * @param earliestEventAt      ISO string of the earliest ever logged event, or null
 * @param recentTimestamps     ISO strings of events within the last 12 months
 * @param todayPH              Today's date already converted to PH timezone
 * @param phTz                 IANA timezone string, e.g. 'Asia/Manila'
 */
export function computePeriodBasedTrackerState(params: {
  config:             CadenceConfig
  lastEventAt:        string | null
  earliestEventAt:    string | null
  recentTimestamps:   string[]
  todayPH:            Date
  phTz:               string
}): PeriodBasedResult {
  const { config, lastEventAt, earliestEventAt, recentTimestamps, todayPH, phTz } = params
  const cadence        = config.frequencyCadence
  const intervalMonths = config.frequencyIntervalMonths
  const currentYear    = todayPH.getFullYear()
  const currentMonth   = todayPH.getMonth() + 1  // 1-based
  const todayMidnight  = new Date(currentYear, todayPH.getMonth(), todayPH.getDate())

  // Never done → always red, bar empty
  if (lastEventAt === null) {
    const periodDays = computePeriodDays(cadence, intervalMonths, currentYear, todayPH.getMonth())
    return { daysRemaining: 0, cycleDays: Math.max(1, periodDays), zone: 'red' }
  }

  // Derive anchor from earliest logged event (1-based month)
  const anchorDate  = toZonedTime(new Date(earliestEventAt ?? lastEventAt), phTz)
  const anchorYear  = anchorDate.getFullYear()
  const anchorMonth = anchorDate.getMonth() + 1   // 1-based

  const isDue = isCurrentPeriodDue(cadence, intervalMonths, anchorYear, anchorMonth, currentYear, currentMonth)

  if (isDue) {
    const targetDate = computeDueDateForMonth(config, currentYear, todayPH.getMonth())
    const daysUntil  = Math.round((targetDate.getTime() - todayMidnight.getTime()) / 86_400_000)
    const periodDays = computePeriodDays(cadence, intervalMonths, currentYear, todayPH.getMonth())

    if (hasEventInMonth(recentTimestamps, currentYear, currentMonth, phTz)) {
      // Period already satisfied — show countdown to next period's due date
      const next       = findNextDueMonth(cadence, intervalMonths, anchorYear, anchorMonth, currentYear, currentMonth)
      const nextTarget = computeDueDateForMonth(config, next.year, next.month - 1)
      const daysNext   = Math.round((nextTarget.getTime() - todayMidnight.getTime()) / 86_400_000)
      const nextDays   = computePeriodDays(cadence, intervalMonths, next.year, next.month - 1)
      return { daysRemaining: daysNext, cycleDays: Math.max(1, nextDays), zone: 'green' }
    }

    const zone: TrackerZone = daysUntil <= 0 ? 'red' : daysUntil <= 5 ? 'yellow' : 'green'
    return { daysRemaining: daysUntil, cycleDays: Math.max(1, periodDays), zone }
  }

  // Not a due month — green countdown to next due date
  const next       = findNextDueMonth(cadence, intervalMonths, anchorYear, anchorMonth, currentYear, currentMonth)
  const nextTarget = computeDueDateForMonth(config, next.year, next.month - 1)
  const daysNext   = Math.round((nextTarget.getTime() - todayMidnight.getTime()) / 86_400_000)
  const nextDays   = computePeriodDays(cadence, intervalMonths, next.year, next.month - 1)
  return { daysRemaining: daysNext, cycleDays: Math.max(1, nextDays), zone: 'green' }
}

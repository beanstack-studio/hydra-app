import type { Bill } from './types'

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const BILL_TYPE_LABELS: Record<string, string> = {
  electricity: 'Electricity',
  water:       'Water',
  internet:    'Internet',
  rent:        'Rent',
  bank:        'Bank',
  other:       'Other',
  maintenance: 'Maintenance',
}

export function makeSeriesKey(billType: string, description: string | null): string {
  return `${billType}::${description ?? ''}`
}

/**
 * Returns true if the current month is a scheduled due month for this
 * recurring series, based on its cadence and the anchor month (the earliest
 * bill in the series that has is_recurring = true).
 *
 * - 'monthly'  → every month is due
 * - 'quarterly' → every 3 months from the anchor
 * - 'custom'   → every intervalMonths months from the anchor
 *
 * Returns false for non-due months so quarterly/custom bills do NOT alert
 * between their scheduled periods.
 */
export function isCurrentMonthDue(
  cadence: string | null,
  intervalMonths: number | null,
  anchorYear: number,
  anchorMonth: number,
  currentYear: number,
  currentMonth: number,
): boolean {
  if (!cadence || cadence === 'monthly') return true

  const interval = cadence === 'quarterly' ? 3 : Math.max(1, intervalMonths ?? 1)
  const elapsed  = (currentYear - anchorYear) * 12 + (currentMonth - anchorMonth)

  // Must be strictly after the anchor AND exactly on a scheduled interval boundary
  return elapsed > 0 && elapsed % interval === 0
}

export interface RecurringSeriesInfo {
  key: string
  label: string
  reminderDay: number
  paymentCap: number | null
  paidCount: number
  urgency: 'yellow' | 'red'
  message: string
}

export function computeRecurringState(
  bills: Bill[],
  todayPH: Date,
): {
  alerts: RecurringSeriesInfo[]
  progressByBillId: Map<string, string>
  noCurrentPeriodBills: boolean
} {
  const currentMonth      = todayPH.getMonth() + 1
  const currentYear       = todayPH.getFullYear()
  const todayDay          = todayPH.getDate()
  const YELLOW_LEAD       = 5
  const currentMonthLabel = `${MONTHS[todayPH.getMonth()]} ${currentYear}`

  // Group all bills by (bill_type, description) series key
  const seriesMap = new Map<string, Bill[]>()
  for (const b of bills) {
    const key      = makeSeriesKey(b.bill_type, b.description)
    const existing = seriesMap.get(key)
    if (existing) { existing.push(b) } else { seriesMap.set(key, [b]) }
  }

  const alerts: RecurringSeriesInfo[]      = []
  const progressBySeriesKey                = new Map<string, string>()

  for (const [key, seriesBills] of seriesMap) {
    // Series is "active recurring" only if at least one bill has is_recurring = true
    const recurringBills = seriesBills.filter((b) => b.is_recurring)
    if (recurringBills.length === 0) continue

    // Earliest recurring bill = fixed anchor for the cadence schedule.
    // Using earliest keeps the due-month schedule stable regardless of which
    // individual bills the user marked recurring.
    const earliest = [...recurringBills]
      .sort((a, b2) => a.year !== b2.year ? a.year - b2.year : a.month - b2.month)[0]

    // Most recent recurring bill = source of truth for live settings
    // (reminder_day, payment_cap, cadence, interval)
    const mostRecent = [...recurringBills]
      .sort((a, b2) => b2.year !== a.year ? b2.year - a.year : b2.month - a.month)[0]

    const reminderDay = mostRecent.reminder_day ?? 1
    const paymentCap  = mostRecent.payment_cap ?? null
    const paidCount   = seriesBills.length
    const cappedOut   = paymentCap !== null && paidCount >= paymentCap

    // Build progress label for capped series (shown on every row in the series)
    if (paymentCap !== null) {
      const suffix = cappedOut ? ' (complete)' : ''
      progressBySeriesKey.set(key, `${paidCount} / ${paymentCap} payments${suffix}`)
    }

    if (cappedOut) continue

    // No alert if the current period already has a bill logged
    const hasCurrentPeriodBill = seriesBills.some(
      (b) => b.month === currentMonth && b.year === currentYear,
    )
    if (hasCurrentPeriodBill) continue

    // ── Cadence guard ──────────────────────────────────────────────────────────
    // Skip entirely if the current month is not a scheduled due month.
    // Quarterly bills only alert in Jan/Apr/Jul/Oct (if anchor = Jan), etc.
    const cadence  = mostRecent.recurrence_cadence
    const interval = mostRecent.recurrence_interval_months ?? null
    if (!isCurrentMonthDue(cadence, interval, earliest.year, earliest.month, currentYear, currentMonth)) continue

    // Determine alert urgency relative to reminder_day
    const daysToReminder = reminderDay - todayDay
    let urgency: 'yellow' | 'red' | null = null
    if (daysToReminder <= 0) {
      urgency = 'red'    // reminder day has passed
    } else if (daysToReminder <= YELLOW_LEAD) {
      urgency = 'yellow' // within 5 days of reminder day
    }
    if (!urgency) continue // too early — reminder day still far off

    const typeLabel  = BILL_TYPE_LABELS[mostRecent.bill_type] ?? mostRecent.bill_type
    const label      = mostRecent.description
      ? `${typeLabel} — ${mostRecent.description}`
      : typeLabel
    const pluralDays = daysToReminder === 1 ? 'day' : 'days'
    const message    = urgency === 'red'
      ? `Reminder day (${reminderDay}) has passed — log ${currentMonthLabel} bill`
      : `Due in ${daysToReminder} ${pluralDays} — log ${currentMonthLabel} bill`

    alerts.push({ key, label, reminderDay, paymentCap, paidCount, urgency, message })
  }

  const noCurrentPeriodBills =
    bills.length > 0 &&
    !bills.some((b) => b.month === currentMonth && b.year === currentYear)

  // Expand series-level progress strings to per-bill-id for O(1) row lookup
  const progressByBillId = new Map<string, string>()
  for (const b of bills) {
    const prog = progressBySeriesKey.get(makeSeriesKey(b.bill_type, b.description))
    if (prog) progressByBillId.set(b.id, prog)
  }

  return { alerts, progressByBillId, noCurrentPeriodBills }
}

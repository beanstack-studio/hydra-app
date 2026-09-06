import { describe, it, expect } from 'vitest'
import { computeRecurringState, isCurrentMonthDue } from './recurringAlerts'
import type { Bill, BillType, RecurrenceCadence } from './types'

// ── Test helper ───────────────────────────────────────────────────────────────

function makeBill(overrides: {
  id: string
  bill_type: BillType
  month: number
  year: number
  description?: string | null
  is_recurring?: boolean
  recurrence_cadence?: RecurrenceCadence | null
  recurrence_interval_months?: number | null
  reminder_day?: number | null
  payment_cap?: number | null
}): Bill {
  return {
    station_id:               'station-1',
    description:              null,
    price:                    500,
    amount:                   500,
    due_date:                 null,
    date_paid:                null,
    payment_method:           null,
    bill_receipt_url:         null,
    payment_receipt_url:      null,
    is_recurring:             false,
    recurrence_cadence:       null,
    recurrence_interval_months: null,
    reminder_day:             null,
    payment_cap:              null,
    created_at:               '2026-01-01T00:00:00Z',
    updated_at:               '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// ── isCurrentMonthDue unit tests ──────────────────────────────────────────────

describe('isCurrentMonthDue', () => {
  it('monthly: every month is due', () => {
    expect(isCurrentMonthDue('monthly', null, 2026, 1, 2026, 2)).toBe(true)
    expect(isCurrentMonthDue('monthly', null, 2026, 1, 2026, 7)).toBe(true)
  })

  it('null cadence defaults to monthly (every month due)', () => {
    expect(isCurrentMonthDue(null, null, 2026, 1, 2026, 2)).toBe(true)
  })

  it('quarterly: due month is exactly 3 months after anchor', () => {
    // Anchor = Jan 2026 → due: Apr, Jul, Oct, Jan 2027
    expect(isCurrentMonthDue('quarterly', null, 2026, 1, 2026, 4)).toBe(true)
    expect(isCurrentMonthDue('quarterly', null, 2026, 1, 2026, 7)).toBe(true)
    expect(isCurrentMonthDue('quarterly', null, 2026, 1, 2026, 10)).toBe(true)
    expect(isCurrentMonthDue('quarterly', null, 2026, 1, 2027, 1)).toBe(true)
  })

  it('quarterly: non-due months return false', () => {
    // Anchor = Jan 2026 → Feb, Mar, May, Jun are non-due
    expect(isCurrentMonthDue('quarterly', null, 2026, 1, 2026, 2)).toBe(false)
    expect(isCurrentMonthDue('quarterly', null, 2026, 1, 2026, 3)).toBe(false)
    expect(isCurrentMonthDue('quarterly', null, 2026, 1, 2026, 5)).toBe(false)
    expect(isCurrentMonthDue('quarterly', null, 2026, 1, 2026, 6)).toBe(false)
  })

  it('quarterly: anchor month itself is false (elapsed = 0)', () => {
    // The anchor bill is already logged, so elapsed=0 must return false
    // to avoid double-alerting (hasCurrentPeriodBill would catch it anyway)
    expect(isCurrentMonthDue('quarterly', null, 2026, 1, 2026, 1)).toBe(false)
  })

  it('custom interval 4: due months are anchor + 4, +8, +12 …', () => {
    // Anchor = Jan 2026 → due: May, Sep, Jan 2027
    expect(isCurrentMonthDue('custom', 4, 2026, 1, 2026, 5)).toBe(true)
    expect(isCurrentMonthDue('custom', 4, 2026, 1, 2026, 9)).toBe(true)
    expect(isCurrentMonthDue('custom', 4, 2026, 1, 2027, 1)).toBe(true)
  })

  it('custom interval 4: non-due months return false', () => {
    expect(isCurrentMonthDue('custom', 4, 2026, 1, 2026, 2)).toBe(false)
    expect(isCurrentMonthDue('custom', 4, 2026, 1, 2026, 3)).toBe(false)
    expect(isCurrentMonthDue('custom', 4, 2026, 1, 2026, 6)).toBe(false)
  })
})

// ── Monthly recurring bill ────────────────────────────────────────────────────

describe('Monthly recurring bill', () => {
  // Anchor = January 2026, reminder_day = 15
  const janBill = makeBill({
    id:                 'elec-jan',
    bill_type:          'electricity',
    month:              1,
    year:               2026,
    is_recurring:       true,
    recurrence_cadence: 'monthly',
    reminder_day:       15,
  })

  it('no alert before reminder window (day 5, reminderDay 15 → 10 days away)', () => {
    const today = new Date(2026, 1, 5)   // Feb 5
    const { alerts } = computeRecurringState([janBill], today)
    expect(alerts).toHaveLength(0)
  })

  it('yellow alert within reminder window (day 11 → 4 days before day 15)', () => {
    const today = new Date(2026, 1, 11)  // Feb 11
    const { alerts } = computeRecurringState([janBill], today)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].urgency).toBe('yellow')
    expect(alerts[0].label).toBe('Electricity')
  })

  it('red alert past reminder day (day 16 > day 15)', () => {
    const today = new Date(2026, 1, 16)  // Feb 16
    const { alerts } = computeRecurringState([janBill], today)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].urgency).toBe('red')
  })

  it('no alert once current-period bill is logged', () => {
    const febBill = makeBill({ id: 'elec-feb', bill_type: 'electricity', month: 2, year: 2026 })
    const today = new Date(2026, 1, 16)  // Feb 16
    const { alerts } = computeRecurringState([janBill, febBill], today)
    expect(alerts).toHaveLength(0)
  })
})

// ── Quarterly recurring bill ──────────────────────────────────────────────────

describe('Quarterly recurring bill (anchor = January 2026, reminder_day = 5)', () => {
  const janBill = makeBill({
    id:                 'elec-jan',
    bill_type:          'electricity',
    month:              1,
    year:               2026,
    is_recurring:       true,
    recurrence_cadence: 'quarterly',
    reminder_day:       5,
  })

  it('NO alert in non-due month Feb (elapsed 1, not divisible by 3) even with reminder_day passed', () => {
    const today = new Date(2026, 1, 6)   // Feb 6 — day 6 > reminderDay 5
    const { alerts } = computeRecurringState([janBill], today)
    expect(alerts).toHaveLength(0)
  })

  it('NO alert in non-due month Mar (elapsed 2)', () => {
    const today = new Date(2026, 2, 6)   // Mar 6
    const { alerts } = computeRecurringState([janBill], today)
    expect(alerts).toHaveLength(0)
  })

  it('red alert in due month Apr (elapsed 3 = 3×1, day 6 > reminderDay 5)', () => {
    const today = new Date(2026, 3, 6)   // Apr 6
    const { alerts } = computeRecurringState([janBill], today)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].urgency).toBe('red')
  })

  it('yellow alert in due month Apr when within window (day 3 → 2 days before day 5)', () => {
    const today = new Date(2026, 3, 3)   // Apr 3
    const { alerts } = computeRecurringState([janBill], today)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].urgency).toBe('yellow')
  })

  it('NO alert in non-due month May after Apr bill logged (elapsed from Jan = 4, 4%3≠0)', () => {
    const aprBill = makeBill({ id: 'elec-apr', bill_type: 'electricity', month: 4, year: 2026 })
    const today = new Date(2026, 4, 20)  // May 20
    const { alerts } = computeRecurringState([janBill, aprBill], today)
    expect(alerts).toHaveLength(0)
  })

  it('red alert in next due month Jul (elapsed from Jan = 6, 6%3=0)', () => {
    const aprBill = makeBill({ id: 'elec-apr', bill_type: 'electricity', month: 4, year: 2026 })
    const today = new Date(2026, 6, 6)   // Jul 6
    const { alerts } = computeRecurringState([janBill, aprBill], today)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].urgency).toBe('red')
  })
})

// ── Custom interval recurring bill ────────────────────────────────────────────

describe('Custom interval bill (every 4 months, anchor = January 2026, reminder_day = 10)', () => {
  const janBill = makeBill({
    id:                          'bank-jan',
    bill_type:                   'bank',
    description:                 'Car Loan',
    month:                       1,
    year:                        2026,
    is_recurring:                true,
    recurrence_cadence:          'custom',
    recurrence_interval_months:  4,
    reminder_day:                10,
  })

  it('NO alert in non-due month Feb (elapsed 1, 1%4≠0)', () => {
    const today = new Date(2026, 1, 11)  // Feb 11 — day > reminderDay
    const { alerts } = computeRecurringState([janBill], today)
    expect(alerts).toHaveLength(0)
  })

  it('NO alert in non-due month Mar (elapsed 2)', () => {
    const today = new Date(2026, 2, 11)
    const { alerts } = computeRecurringState([janBill], today)
    expect(alerts).toHaveLength(0)
  })

  it('NO alert in non-due month Apr (elapsed 3, 3%4≠0)', () => {
    const today = new Date(2026, 3, 11)
    const { alerts } = computeRecurringState([janBill], today)
    expect(alerts).toHaveLength(0)
  })

  it('red alert in due month May (elapsed 4, 4%4=0, day 11 > reminderDay 10)', () => {
    const today = new Date(2026, 4, 11)  // May 11
    const { alerts } = computeRecurringState([janBill], today)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].urgency).toBe('red')
    expect(alerts[0].label).toBe('Bank — Car Loan')
  })

  it('NO alert in non-due month Jun (elapsed 5, 5%4≠0)', () => {
    const today = new Date(2026, 5, 11)
    const { alerts } = computeRecurringState([janBill], today)
    expect(alerts).toHaveLength(0)
  })

  it('red alert in next due month Sep (elapsed 8, 8%4=0)', () => {
    const mayBill = makeBill({ id: 'bank-may', bill_type: 'bank', description: 'Car Loan', month: 5, year: 2026 })
    const today = new Date(2026, 8, 11)  // Sep 11
    const { alerts } = computeRecurringState([janBill, mayBill], today)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].urgency).toBe('red')
  })
})

// ── Capped bill (payment_cap) ─────────────────────────────────────────────────

describe('Capped recurring bill (payment_cap = 5)', () => {
  // Build a series of N monthly bills (all sharing same bill_type + description)
  function makeLoanSeries(count: number): Bill[] {
    return Array.from({ length: count }, (_, i) => makeBill({
      id:                 `loan-${i}`,
      bill_type:          'bank',
      description:        'Home Loan',
      month:              i + 1,         // Jan, Feb, Mar …
      year:               2026,
      is_recurring:       i === 0,       // only the first bill carries the flag
      recurrence_cadence: i === 0 ? 'monthly' : null,
      reminder_day:       10,
      payment_cap:        5,
    }))
  }

  it('alert fires (red) at cap-1 payments (3/5) when in due month past reminder_day', () => {
    const bills = makeLoanSeries(3)      // Jan, Feb, Mar logged
    const today = new Date(2026, 3, 11)  // Apr 11 — next due, day > reminderDay
    const { alerts, progressByBillId } = computeRecurringState(bills, today)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].urgency).toBe('red')
    // Progress shown on all 3 bill rows
    expect(progressByBillId.get('loan-0')).toBe('3 / 5 payments')
    expect(progressByBillId.get('loan-1')).toBe('3 / 5 payments')
    expect(progressByBillId.get('loan-2')).toBe('3 / 5 payments')
  })

  it('NO alert when paidCount equals paymentCap (5/5 = complete)', () => {
    const bills = makeLoanSeries(5)      // Jan–May logged (cap reached)
    const today = new Date(2026, 5, 11)  // Jun 11 — next due month
    const { alerts, progressByBillId } = computeRecurringState(bills, today)
    expect(alerts).toHaveLength(0)
    // Progress shows "complete" on all 5 rows
    expect(progressByBillId.get('loan-0')).toBe('5 / 5 payments (complete)')
    expect(progressByBillId.get('loan-4')).toBe('5 / 5 payments (complete)')
  })

  it('NO alert and correct progress when paidCount exceeds paymentCap (7/5)', () => {
    const bills = makeLoanSeries(7)      // 7 bills logged, cap=5
    const today = new Date(2026, 7, 11)  // Aug 11
    const { alerts, progressByBillId } = computeRecurringState(bills, today)
    expect(alerts).toHaveLength(0)
    expect(progressByBillId.get('loan-0')).toBe('7 / 5 payments (complete)')
    expect(progressByBillId.get('loan-6')).toBe('7 / 5 payments (complete)')
  })
})

// ── noCurrentPeriodBills flag ─────────────────────────────────────────────────

describe('noCurrentPeriodBills', () => {
  it('true when past bills exist but none for the current month', () => {
    const bill = makeBill({ id: '1', bill_type: 'electricity', month: 1, year: 2026 })
    const today = new Date(2026, 1, 5)   // Feb 2026 — no Feb bill
    const { noCurrentPeriodBills } = computeRecurringState([bill], today)
    expect(noCurrentPeriodBills).toBe(true)
  })

  it('false when current month has at least one bill', () => {
    const bill = makeBill({ id: '1', bill_type: 'electricity', month: 2, year: 2026 })
    const today = new Date(2026, 1, 5)   // Feb 2026 — Feb bill exists
    const { noCurrentPeriodBills } = computeRecurringState([bill], today)
    expect(noCurrentPeriodBills).toBe(false)
  })

  it('false when the bills array is empty', () => {
    const today = new Date(2026, 1, 5)
    const { noCurrentPeriodBills } = computeRecurringState([], today)
    expect(noCurrentPeriodBills).toBe(false)
  })
})

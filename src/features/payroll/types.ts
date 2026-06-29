import type { DayKey, PayType } from '@/features/settings/types'

export type { PayType }
export type PaymentMode = 'cash' | 'gcash' | 'maya'
export type PayrollStatus = 'draft' | 'paid'

export interface StaffSchedule {
  id: string
  station_id: string
  staff_id: string
  day_of_week: DayKey
  shift_start: string
  shift_end: string
  is_active: boolean
  created_at: string
}

export interface StaffScheduleInput {
  day_of_week: DayKey
  shift_start: string
  shift_end: string
  is_active: boolean
}

export interface TimeLog {
  id: string
  station_id: string
  staff_id: string
  log_date: string
  clock_in: string
  clock_out: string | null
  hours_worked: number | null
  notes: string | null
  created_at: string
}

export interface TimeLogInput {
  staff_id: string
  log_date: string
  clock_in: string
  clock_out: string | null
  hours_worked: number | null
  notes: string | null
}

export interface PayrollRun {
  id: string
  station_id: string
  period_start: string
  period_end: string
  status: PayrollStatus
  total_amount: number | null
  paid_at: string | null
  created_at: string
  payroll_items?: PayrollItem[]
}

export interface PayrollItem {
  id: string
  station_id: string
  payroll_run_id: string
  staff_id: string
  staff_name: string
  hours_worked: number | null
  days_worked: number | null
  pay_type: PayType
  pay_rate: number
  gross_pay: number
  payment_mode: PaymentMode | null
  notes: string | null
  created_at: string
}

export interface PayPreviewItem {
  staff_id: string
  staff_name: string
  pay_type: PayType
  pay_rate: number
  hours_worked: number
  days_worked: number
  gross_pay: number
}

// Parses "8:00 AM" → minutes since midnight
const parseTimeToMinutes = (slot: string): number => {
  const [timePart, period] = slot.split(' ')
  const [hStr, mStr] = timePart.split(':')
  let h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  if (period === 'AM' && h === 12) h = 0
  if (period === 'PM' && h !== 12) h += 12
  return h * 60 + m
}

export const computeHoursWorked = (clockIn: string, clockOut: string): number =>
  Math.max(0, Math.round((parseTimeToMinutes(clockOut) - parseTimeToMinutes(clockIn)) / 60 * 100) / 100)

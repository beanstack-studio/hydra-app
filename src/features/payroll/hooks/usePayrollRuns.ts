import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { PayrollRun, PayPreviewItem, TimeLog, PaymentMode } from '../types'
import type { StaffMember } from '@/features/settings/hooks/useTeamSettings'

interface UsePayrollRunsReturn {
  data: PayrollRun[]
  isLoading: boolean
  error: string | null
  runPayroll: (
    periodStart: string,
    periodEnd: string,
    paidDate: string,
    items: Array<PayPreviewItem & { payment_mode: PaymentMode | null }>
  ) => Promise<void>
}

// Pure computation — no Supabase. Can be imported directly by modal components.
export function computePayPreview(
  staff: StaffMember[],
  timeLogs: TimeLog[],
  periodStart: string,
  periodEnd: string
): PayPreviewItem[] {
  return staff
    .filter((s) => s.pay_type !== null && s.pay_rate !== null)
    .map((s) => {
      const logs = timeLogs.filter(
        (l) => l.staff_id === s.id && l.log_date >= periodStart && l.log_date <= periodEnd
      )
      const totalHours = Math.round(logs.reduce((sum, l) => sum + (l.hours_worked ?? 0), 0) * 100) / 100
      const totalDays = new Set(logs.map((l) => l.log_date)).size
      const grossPay =
        s.pay_type === 'hourly'
          ? Math.round(totalHours * (s.pay_rate ?? 0) * 100) / 100
          : Math.round(totalDays * (s.pay_rate ?? 0) * 100) / 100
      return {
        staff_id: s.id,
        staff_name: s.full_name,
        pay_type: s.pay_type!,
        pay_rate: s.pay_rate ?? 0,
        hours_worked: totalHours,
        days_worked: totalDays,
        gross_pay: grossPay,
      }
    })
    .filter((item) => item.gross_pay > 0)
}

export function usePayrollRuns(): UsePayrollRunsReturn {
  const stationId = useAuthStore((s) => s.stationId)
  const [data, setData] = useState<PayrollRun[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) { setIsLoading(false); return }
    setError(null)
    try {
      const { data: runs, error: e } = await supabase
        .from('payroll_runs')
        .select('*, payroll_items(*)')
        .eq('station_id', stationId)
        .order('created_at', { ascending: false })
      if (e) throw new Error(e.message)
      setData((runs ?? []) as PayrollRun[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payroll runs')
    } finally {
      setIsLoading(false)
    }
  }, [stationId])

  useEffect(() => { void fetchData() }, [fetchData])

  const runPayroll = useCallback(async (
    periodStart: string,
    periodEnd: string,
    paidDate: string,
    items: Array<PayPreviewItem & { payment_mode: PaymentMode | null }>
  ) => {
    if (!stationId || items.length === 0) return
    const totalAmount = items.reduce((sum, i) => sum + i.gross_pay, 0)

    // 1. Create the payroll run record
    const { data: run, error: runErr } = await supabase
      .from('payroll_runs')
      .insert({
        station_id: stationId,
        period_start: periodStart,
        period_end: periodEnd,
        status: 'paid',
        total_amount: totalAmount,
        paid_at: paidDate,
      })
      .select()
      .single()
    if (runErr) throw new Error(runErr.message)

    // 2. Create one payroll_item per staff member
    const { error: itemsErr } = await supabase.from('payroll_items').insert(
      items.map((item) => ({
        station_id: stationId,
        payroll_run_id: run.id,
        staff_id: item.staff_id,
        staff_name: item.staff_name,
        hours_worked: item.pay_type === 'hourly' ? item.hours_worked : null,
        days_worked: item.pay_type === 'daily' ? item.days_worked : null,
        pay_type: item.pay_type,
        pay_rate: item.pay_rate,
        gross_pay: item.gross_pay,
        payment_mode: item.payment_mode,
      }))
    )
    if (itemsErr) throw new Error(itemsErr.message)

    // 3. Create one labor expense per staff member (auto-links payroll to expenses)
    const { error: expErr } = await supabase.from('expenses').insert(
      items.map((item) => ({
        station_id: stationId,
        category: 'labor',
        item: `Payroll: ${item.staff_name}`,
        price: item.gross_pay,
        amount: item.gross_pay,
        frequency: 'one_off',
        expense_date: paidDate,
        payment_method: item.payment_mode ?? null,
        remarks: `${item.staff_name} — ${periodStart} to ${periodEnd}`,
      }))
    )
    if (expErr) throw new Error(expErr.message)

    await fetchData()
  }, [stationId, fetchData])

  return { data, isLoading, error, runPayroll }
}

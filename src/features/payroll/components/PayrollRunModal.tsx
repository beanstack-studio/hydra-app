import { useState, useMemo, useEffect } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { Modal } from '@/components/shared/Modal'
import { DatePickerInput } from '@/components/shared/DatePickerInput'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/shared/EmptyState'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, PH_TZ } from '@/lib/utils'
import type { PayrollRun, PayPreviewItem, PaymentMode } from '../types'
import type { StaffMember } from '@/features/settings/hooks/useTeamSettings'

// ── Constants ─────────────────────────────────────────────────────────────────

const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: 'cash',  label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'maya',  label: 'Maya' },
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface ManualEntry {
  units: string
}

interface PayrollRunModalProps {
  isOpen: boolean
  onClose: () => void
  staff: StaffMember[]
  existingRuns: PayrollRun[]
  onRun: (
    periodStart: string,
    periodEnd: string,
    paidDate: string,
    items: Array<PayPreviewItem & { payment_mode: PaymentMode | null }>
  ) => Promise<void>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nextDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function prevDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d - 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PayrollRunModal({ isOpen, onClose, staff, existingRuns, onRun }: PayrollRunModalProps) {
  const { toast } = useToast()
  const todayPH      = formatInTimeZone(new Date(), PH_TZ, 'yyyy-MM-dd')
  const firstOfMonth = todayPH.slice(0, 8) + '01'

  // The earliest valid start date = day after the latest end across all existing runs
  const minPeriodStart = useMemo((): string | undefined => {
    if (existingRuns.length === 0) return undefined
    const latestEnd = existingRuns.reduce((max, r) => (r.period_end > max ? r.period_end : max), '')
    return nextDay(latestEnd)
  }, [existingRuns])

  const [periodStart,  setPeriodStart]  = useState(firstOfMonth)
  const [periodEnd,    setPeriodEnd]    = useState(todayPH)
  const [paymentDate,  setPaymentDate]  = useState(todayPH)
  const [paymentMode,  setPaymentMode]  = useState<PaymentMode | null>(null)
  const [entries,      setEntries]      = useState<Record<string, ManualEntry>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Snap periodStart forward when modal opens with a default that falls in a locked range
  useEffect(() => {
    if (!isOpen) return
    if (minPeriodStart && periodStart < minPeriodStart) {
      setPeriodStart(minPeriodStart)
      if (periodEnd < minPeriodStart) setPeriodEnd(minPeriodStart)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, minPeriodStart])

  // Max end date = day before the nearest future locked run that starts after periodStart
  const maxPeriodEnd = useMemo((): string | undefined => {
    const nextRun = existingRuns
      .filter((r) => r.period_start > periodStart)
      .sort((a, b) => a.period_start.localeCompare(b.period_start))[0]
    if (!nextRun) return undefined
    return prevDay(nextRun.period_start)
  }, [existingRuns, periodStart])

  const eligibleStaff = useMemo(
    () => staff.filter((s) => s.pay_rate != null && s.pay_type != null),
    [staff]
  )

  const getEntry = (staffId: string): ManualEntry =>
    entries[staffId] ?? { units: '' }

  const setUnits = (staffId: string, units: string) =>
    setEntries((prev) => ({ ...prev, [staffId]: { ...getEntry(staffId), units } }))

  const previewItems = useMemo((): Array<PayPreviewItem & { payment_mode: PaymentMode | null }> =>
    eligibleStaff
      .map((s) => {
        const entry    = getEntry(s.id)
        const units    = parseFloat(entry.units) || 0
        const grossPay = Math.round(units * (s.pay_rate ?? 0) * 100) / 100
        return {
          staff_id:     s.id,
          staff_name:   s.full_name,
          pay_type:     s.pay_type!,
          pay_rate:     s.pay_rate ?? 0,
          hours_worked: s.pay_type === 'hourly' ? units : 0,
          days_worked:  s.pay_type === 'daily'  ? units : 0,
          gross_pay:    grossPay,
          payment_mode: paymentMode,
        }
      })
      .filter((item) => item.gross_pay > 0),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [eligibleStaff, entries, paymentMode])

  const grandTotal = previewItems.reduce((sum, i) => sum + i.gross_pay, 0)

  const handleRun = async () => {
    if (previewItems.length === 0) {
      toast({
        title: 'Nothing to run',
        description: 'Enter days or hours worked for at least one staff member.',
        variant: 'destructive',
      })
      return
    }
    setIsSubmitting(true)
    try {
      await onRun(periodStart, periodEnd, paymentDate, previewItems)
      toast({
        title: 'Payroll complete',
        description: `${formatCurrency(grandTotal)} in labor expenses created.`,
      })
      setEntries({})
      onClose()
    } catch (e) {
      toast({
        title: 'Payroll failed',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Run Payroll" size="sm">
      <div className="space-y-5">

        {/* ── Period ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="pr-from">Period Start</Label>
            <DatePickerInput
              id="pr-from"
              value={periodStart}
              onChange={(v) => { setPeriodStart(v); if (v > periodEnd) setPeriodEnd(v) }}
              min={minPeriodStart}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pr-to">Period End</Label>
            <DatePickerInput
              id="pr-to"
              value={periodEnd}
              onChange={setPeriodEnd}
              min={periodStart}
              max={maxPeriodEnd}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="pr-paid">Payment Date <span className="text-destructive">*</span></Label>
            <DatePickerInput id="pr-paid" value={paymentDate} onChange={setPaymentDate} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pr-pay-method">Payment Method</Label>
            <select
              id="pr-pay-method"
              value={paymentMode ?? ''}
              onChange={(e) => setPaymentMode((e.target.value as PaymentMode) || null)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">— Select —</option>
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Staff entries ───────────────────────────────────────────── */}
        {eligibleStaff.length === 0 ? (
          <EmptyState
            icon={null}
            title="No payable staff"
            description="Add a pay rate to at least one team member first."
          />
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Days Worked
            </p>
            <div className="rounded-lg border border-border divide-y divide-border">
              {eligibleStaff.map((s) => {
                const entry    = getEntry(s.id)
                const units    = parseFloat(entry.units) || 0
                const computed = units > 0
                  ? Math.round(units * (s.pay_rate ?? 0) * 100) / 100
                  : null

                return (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {s.full_name}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {formatCurrency(s.pay_rate ?? 0)}/{s.pay_type === 'hourly' ? 'hr' : 'day'}
                        </span>
                      </p>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={entry.units}
                      onChange={(e) => setUnits(s.id, e.target.value)}
                      className="h-8 w-14 text-sm text-right shrink-0"
                    />
                    <span className={`text-sm font-semibold shrink-0 w-24 text-right ${computed != null && computed > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                      {computed != null && computed > 0 ? formatCurrency(computed) : '—'}
                    </span>
                  </div>
                )
              })}
            </div>

            {grandTotal > 0 && (
              <div className="flex items-center justify-between px-1 pt-1">
                <span className="text-sm font-semibold">Total Payroll</span>
                <span className="text-base font-bold">{formatCurrency(grandTotal)}</span>
              </div>
            )}

          </div>
        )}

        {/* ── Actions ─────────────────────────────────────────────────── */}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            className="flex-1"
            disabled={isSubmitting || previewItems.length === 0}
            onClick={() => void handleRun()}
          >
            {isSubmitting ? 'Running…' : 'Run Payroll'}
          </Button>
        </div>

      </div>
    </Modal>
  )
}

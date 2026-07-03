import { useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { ChevronDown, ChevronUp, Play, ArrowUpDown, Trash2, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { Modal } from '@/components/shared/Modal'
import { DatePickerInput } from '@/components/shared/DatePickerInput'
import { PayrollRunModal } from './PayrollRunModal'
import { PayrollDetailModal } from './PayrollDetailModal'
import { formatDate, formatCurrency, cn, PH_TZ } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/stores/authStore'
import type { StaffMember } from '@/features/settings/hooks/useTeamSettings'
import type { PayrollRun, PayPreviewItem, PaymentMode } from '../types'

const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: 'cash',  label: 'Cash'  },
  { value: 'gcash', label: 'GCash' },
  { value: 'maya',  label: 'Maya'  },
]

interface PayrollRunTabProps {
  staff: StaffMember[]
  payrollRuns: PayrollRun[]
  isLoading: boolean
  onRun: (
    periodStart: string,
    periodEnd: string,
    paidDate: string,
    items: Array<PayPreviewItem & { payment_mode: PaymentMode | null }>
  ) => Promise<void>
  onPayRun: (runId: string, paidDate: string, paymentMode: PaymentMode | null) => Promise<void>
  onDelete: (runId: string) => Promise<void>
}

type PayrollSortKey = 'period' | 'pmt_date' | 'total'
type SortDir = 'asc' | 'desc'

export function PayrollRunTab({ staff, payrollRuns, isLoading, onRun, onPayRun, onDelete }: PayrollRunTabProps) {
  const { toast } = useToast()
  const isOwner = useAuthStore((s) => s.role) === 'owner'
  const todayPH = formatInTimeZone(new Date(), PH_TZ, 'yyyy-MM-dd')

  const [isRunModalOpen,  setIsRunModalOpen]  = useState(false)
  const [detailRun,       setDetailRun]       = useState<PayrollRun | null>(null)
  const [deletingRun,     setDeletingRun]     = useState<PayrollRun | null>(null)
  const [isDeleting,      setIsDeleting]      = useState(false)
  const [payingRun,       setPayingRun]       = useState<PayrollRun | null>(null)
  const [payRunDate,      setPayRunDate]      = useState(todayPH)
  const [payRunMode,      setPayRunMode]      = useState<PaymentMode | null>(null)
  const [isPaying,        setIsPaying]        = useState(false)
  const [sortKey,         setSortKey]         = useState<PayrollSortKey>('period')
  const [sortDir,         setSortDir]         = useState<SortDir>('desc')

  const handleSort = (key: PayrollSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...payrollRuns].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'period')   cmp = a.period_start.localeCompare(b.period_start)
    if (sortKey === 'pmt_date') cmp = (a.paid_at ?? '').localeCompare(b.paid_at ?? '')
    if (sortKey === 'total')    cmp = (a.total_amount ?? 0) - (b.total_amount ?? 0)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const sortIcon = (key: PayrollSortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3 w-3 opacity-40" />
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
  }

  const handlePayRun = async () => {
    if (!payingRun || !payRunDate) return
    setIsPaying(true)
    try {
      await onPayRun(payingRun.id, payRunDate, payRunMode)
      toast({ title: 'Payroll marked as paid' })
      setPayingRun(null)
      setPayRunMode(null)
    } catch (e) {
      toast({ title: 'Failed to mark paid', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setIsPaying(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingRun) return
    setIsDeleting(true)
    try {
      await onDelete(deletingRun.id)
      toast({ title: 'Payroll run deleted' })
      setDeletingRun(null)
    } catch (e) {
      toast({ title: 'Delete failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  const thCls = cn(
    'px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-foreground transition-colors duration-150'
  )

  if (isLoading) return <LoadingSkeleton rows={3} />

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => setIsRunModalOpen(true)}>
            <Play className="h-4 w-4 mr-1.5" />
            Run Payroll
          </Button>
        </div>

        {payrollRuns.length === 0 ? (
          <EmptyState
            icon={<Play className="h-8 w-8" />}
            title="No payroll runs yet"
            description="Click 'Run Payroll' to compute and record pay for your staff."
          />
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className={thCls} onClick={() => handleSort('period')}>
                    <span className="inline-flex items-center gap-1">Period {sortIcon('period')}</span>
                  </th>
                  <th className={thCls} onClick={() => handleSort('pmt_date')}>
                    <span className="inline-flex items-center gap-1">Pmt Date {sortIcon('pmt_date')}</span>
                  </th>
                  <th className={thCls} onClick={() => handleSort('total')}>
                    <span className="inline-flex items-center gap-1">Total {sortIcon('total')}</span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((run) => (
                  <tr
                    key={run.id}
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-accent transition-colors duration-150"
                    onClick={() => setDetailRun(run)}
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium">
                        {formatDate(run.period_start + 'T00:00:00')} – {formatDate(run.period_end + 'T00:00:00')}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {run.paid_at
                        ? <span className="text-sm">{formatDate(run.paid_at + 'T00:00:00')}</span>
                        : <span className="text-sm text-muted-foreground">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold">{formatCurrency(run.total_amount ?? 0)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={run.status === 'paid' ? 'default' : 'destructive'}>
                        {run.status === 'paid' ? 'Paid' : 'Unpaid'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {isOwner && run.status !== 'paid' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-primary hover:text-primary"
                            title="Mark as paid"
                            onClick={(e) => { e.stopPropagation(); setPayingRun(run); setPayRunDate(todayPH); setPayRunMode(null) }}
                          >
                            <CreditCard className="h-4 w-4" />
                          </Button>
                        )}
                        {isOwner && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeletingRun(run) }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PayrollRunModal
        isOpen={isRunModalOpen}
        onClose={() => setIsRunModalOpen(false)}
        staff={staff}
        existingRuns={payrollRuns}
        onRun={onRun}
      />

      <PayrollDetailModal
        run={detailRun}
        isOpen={detailRun !== null}
        onClose={() => setDetailRun(null)}
      />

      <Modal isOpen={!!payingRun} onClose={() => setPayingRun(null)} title="Mark as Paid" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Record payment for{' '}
            <span className="font-semibold text-foreground">
              {payingRun ? `${formatDate(payingRun.period_start + 'T00:00:00')} to ${formatDate(payingRun.period_end + 'T00:00:00')}` : ''}
            </span>
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="pay-run-date">Payment Date <span className="text-destructive">*</span></Label>
            <DatePickerInput id="pay-run-date" value={payRunDate} onChange={setPayRunDate} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-run-mode">Payment Method</Label>
            <select
              id="pay-run-mode"
              value={payRunMode ?? ''}
              onChange={(e) => setPayRunMode((e.target.value as PaymentMode) || null)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">— Select —</option>
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setPayingRun(null)}>
              Cancel
            </Button>
            <Button type="button" className="flex-1" disabled={isPaying || !payRunDate} onClick={handlePayRun}>
              {isPaying ? 'Saving…' : 'Confirm'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!deletingRun} onClose={() => setDeletingRun(null)} title="Delete Payroll Run" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Delete payroll run for{' '}
            <span className="font-semibold text-foreground">
              {deletingRun ? `${formatDate(deletingRun.period_start + 'T00:00:00')} to ${formatDate(deletingRun.period_end + 'T00:00:00')}` : ''}
            </span>?{' '}
            This will also delete all payroll items and related expense entries for this run. This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setDeletingRun(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" className="flex-1" disabled={isDeleting} onClick={handleDelete}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

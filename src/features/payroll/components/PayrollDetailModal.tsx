import { Modal } from '@/components/shared/Modal'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { PayrollRun } from '../types'

interface PayrollDetailModalProps {
  run: PayrollRun | null
  isOpen: boolean
  onClose: () => void
}

export function PayrollDetailModal({ run, isOpen, onClose }: PayrollDetailModalProps) {
  if (!run) return null

  const items = run.payroll_items ?? []

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Payroll Details" size="sm">
      {/* ── Header info ─────────────────────────────────────────────── */}
      <div className="mb-4 rounded-md bg-muted/40 px-4 py-3 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            {formatDate(run.period_start + 'T00:00:00')} – {formatDate(run.period_end + 'T00:00:00')}
          </p>
          <Badge variant={run.status === 'paid' ? 'default' : 'outline'}>
            {run.status === 'paid' ? 'Paid' : 'Draft'}
          </Badge>
        </div>
        {run.paid_at && (
          <p className="text-xs text-muted-foreground">
            Payment date: {formatDate(run.paid_at + 'T00:00:00')}
          </p>
        )}
      </div>

      {/* ── Staff table ─────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No staff items found.</p>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Staff
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Days
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Rate
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const days = item.days_worked ?? item.hours_worked ?? 0
                return (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5">
                      <p className="font-medium">{item.staff_name}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{days} days</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">
                      {formatCurrency(item.pay_rate)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold">
                      {formatCurrency(item.gross_pay)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/20">
                <td className="px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide" colSpan={3}>
                  Total
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-bold">
                  {formatCurrency(run.total_amount ?? 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Modal>
  )
}

import type { LucideIcon } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatDate } from '@/lib/utils'
import type { LabTestHistoryRow } from '../hooks/useBacteriologicalTestHistory'

interface IntervalTrackerHistoryModalProps {
  isOpen:           boolean
  onClose:          () => void
  title:            string
  icon:             LucideIcon
  data:             LabTestHistoryRow[]
  isLoading:        boolean
  error:            string | null
  emptyTitle:       string
  emptyDescription: string
}

export function IntervalTrackerHistoryModal({
  isOpen,
  onClose,
  title,
  icon: Icon,
  data,
  isLoading,
  error,
  emptyTitle,
  emptyDescription,
}: IntervalTrackerHistoryModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : data.length === 0 ? (
        <EmptyState
          icon={<Icon className="h-8 w-8" />}
          title={emptyTitle}
          description={emptyDescription}
        />
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  Days since previous
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs text-muted-foreground">{formatDate(row.tested_at)}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm font-medium">
                      {row.days_since_prev !== null
                        ? `${row.days_since_prev} day${row.days_since_prev !== 1 ? 's' : ''}`
                        : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">{row.notes ?? '—'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

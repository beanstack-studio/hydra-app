import { Filter } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { useFilterReplacementHistory } from '../hooks/useFilterReplacementHistory'
import { formatDate } from '@/lib/utils'

interface FilterReplacementHistoryModalProps {
  isOpen: boolean
  onClose: () => void
}

export function FilterReplacementHistoryModal({ isOpen, onClose }: FilterReplacementHistoryModalProps) {
  const { data, isLoading, error } = useFilterReplacementHistory(isOpen)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Filter Replacement History" size="sm">
      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : data.length === 0 ? (
        <EmptyState
          icon={<Filter className="h-8 w-8" />}
          title="No replacements yet"
          description="History will appear here after the first filter replacement is logged."
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
                    <span className="text-xs text-muted-foreground">{formatDate(row.replaced_at)}</span>
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

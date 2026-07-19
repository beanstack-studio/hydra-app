import { Droplets } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { useBackwashHistory } from '../hooks/useBackwashHistory'
import { formatDate } from '@/lib/utils'

interface BackwashHistoryModalProps {
  isOpen: boolean
  onClose: () => void
}

export function BackwashHistoryModal({ isOpen, onClose }: BackwashHistoryModalProps) {
  const { data, isLoading, error } = useBackwashHistory(isOpen)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Backwash History" size="sm">
      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : data.length === 0 ? (
        <EmptyState
          icon={<Droplets className="h-8 w-8" />}
          title="No backwash events yet"
          description="History will appear here after the first backwash is logged."
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
                  Refills since previous
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
                    <span className="text-xs text-muted-foreground">{formatDate(row.backwashed_at)}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm font-medium">
                      {row.refills_since_prev !== null
                        ? row.refills_since_prev.toLocaleString()
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

import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { DataTable } from '@/components/shared/DataTable'
import type { Column } from '@/components/shared/DataTable'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatDate } from '@/lib/utils'
import type { LabTestHistoryRow } from '../hooks/useBacteriologicalTestHistory'

const columns: Column<LabTestHistoryRow>[] = [
  {
    key: 'tested_at',
    header: 'Date',
    sortable: true,
    render: (row) => (
      <span className="text-xs text-muted-foreground">{formatDate(row.tested_at)}</span>
    ),
  },
  {
    key: 'days_since_prev',
    header: 'Days since previous',
    sortable: true,
    render: (row) => (
      <span className="text-sm font-medium">
        {row.days_since_prev !== null
          ? `${row.days_since_prev} day${row.days_since_prev !== 1 ? 's' : ''}`
          : '—'}
      </span>
    ),
  },
  {
    key: 'notes',
    header: 'Notes',
    render: (row) => (
      <span className="text-xs text-muted-foreground">{row.notes ?? '—'}</span>
    ),
  },
]

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
  const [sortKey, setSortKey] = useState<string>('tested_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const handleSort = (key: string) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...data].sort((a, b) => {
    if (sortKey === 'tested_at') {
      const diff = new Date(a.tested_at).getTime() - new Date(b.tested_at).getTime()
      return sortDir === 'asc' ? diff : -diff
    }
    if (sortKey === 'days_since_prev') {
      const av = a.days_since_prev ?? -Infinity
      const bv = b.days_since_prev ?? -Infinity
      return sortDir === 'asc' ? av - bv : bv - av
    }
    return 0
  })

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
        <DataTable
          columns={columns}
          data={sorted}
          rowKey={(row) => row.id}
          pageSize={25}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
        />
      )}
    </Modal>
  )
}

import { useState } from 'react'
import { Filter } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { DataTable } from '@/components/shared/DataTable'
import type { Column } from '@/components/shared/DataTable'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { useFilterReplacementHistory } from '../hooks/useFilterReplacementHistory'
import type { FilterReplacementHistoryRow } from '../hooks/useFilterReplacementHistory'
import { formatDate } from '@/lib/utils'

const columns: Column<FilterReplacementHistoryRow>[] = [
  {
    key: 'replaced_at',
    header: 'Date',
    sortable: true,
    render: (row) => (
      <span className="text-xs text-muted-foreground">{formatDate(row.replaced_at)}</span>
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

interface FilterReplacementHistoryModalProps {
  isOpen: boolean
  onClose: () => void
}

export function FilterReplacementHistoryModal({ isOpen, onClose }: FilterReplacementHistoryModalProps) {
  const { data, isLoading, error } = useFilterReplacementHistory(isOpen)
  const [sortKey, setSortKey] = useState<string>('replaced_at')
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
    if (sortKey === 'replaced_at') {
      const diff = new Date(a.replaced_at).getTime() - new Date(b.replaced_at).getTime()
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
    <Modal isOpen={isOpen} onClose={onClose} title="Filter Replacement History" size="md">
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

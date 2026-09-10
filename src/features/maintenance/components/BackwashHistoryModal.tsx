import { useState } from 'react'
import { Droplets } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { DataTable } from '@/components/shared/DataTable'
import type { Column } from '@/components/shared/DataTable'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { useBackwashHistory } from '../hooks/useBackwashHistory'
import type { BackwashHistoryRow } from '../hooks/useBackwashHistory'
import { formatDate } from '@/lib/utils'

const columns: Column<BackwashHistoryRow>[] = [
  {
    key: 'backwashed_at',
    header: 'Date',
    sortable: true,
    render: (row) => (
      <span className="text-xs text-muted-foreground">{formatDate(row.backwashed_at)}</span>
    ),
  },
  {
    key: 'refills_since_prev',
    header: 'Refills since previous',
    sortable: true,
    render: (row) => (
      <span className="text-sm font-medium">
        {row.refills_since_prev !== null ? row.refills_since_prev.toLocaleString() : '—'}
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

interface BackwashHistoryModalProps {
  isOpen: boolean
  onClose: () => void
}

export function BackwashHistoryModal({ isOpen, onClose }: BackwashHistoryModalProps) {
  const { data, isLoading, error } = useBackwashHistory(isOpen)
  const [sortKey, setSortKey] = useState<string>('backwashed_at')
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
    if (sortKey === 'backwashed_at') {
      const diff = new Date(a.backwashed_at).getTime() - new Date(b.backwashed_at).getTime()
      return sortDir === 'asc' ? diff : -diff
    }
    if (sortKey === 'refills_since_prev') {
      const av = a.refills_since_prev ?? -Infinity
      const bv = b.refills_since_prev ?? -Infinity
      return sortDir === 'asc' ? av - bv : bv - av
    }
    return 0
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Backwash History" size="md">
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

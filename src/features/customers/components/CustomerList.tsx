import { useState } from 'react'
import { Users, Trash2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatDate, formatCurrency, formatPhone, cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import type { Customer, CustomerType } from '../types'

type CustomerSortKey = 'name' | 'type' | 'last_ordered' | 'balance'
type SortDir = 'asc' | 'desc'

const TYPE_LABELS: Record<CustomerType, string> = {
  walk_in: 'Walk-in',
  regular: 'Regular',
  retailer: 'Retailer',
}

const TYPE_VARIANT: Record<CustomerType, 'default' | 'secondary' | 'outline'> = {
  walk_in: 'outline',
  regular: 'default',
  retailer: 'secondary',
}

interface CustomerListProps {
  customers: Customer[]
  onEdit: (customer: Customer) => void
  onDelete: (customer: Customer) => void
  onView: (customer: Customer) => void
  onExport: () => void
}

export function CustomerList({ onDelete, onView, customers, onExport }: CustomerListProps) {
  const isOwner = useAuthStore((s) => s.role) === 'owner'
  const [sortKey, setSortKey] = useState<CustomerSortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (key: string) => {
    const k = key as CustomerSortKey
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(k)
      setSortDir('asc')
    }
  }

  const sorted = [...customers].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
    else if (sortKey === 'type') cmp = a.type.localeCompare(b.type)
    else if (sortKey === 'last_ordered') {
      if (!a.last_ordered_at && !b.last_ordered_at) cmp = 0
      else if (!a.last_ordered_at) return 1
      else if (!b.last_ordered_at) return -1
      else cmp = a.last_ordered_at.localeCompare(b.last_ordered_at)
    }
    else if (sortKey === 'balance') cmp = (a.total_balance ?? 0) - (b.total_balance ?? 0)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const columns = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (c: Customer) => (
        <p className="text-sm font-medium text-foreground">{c.name}</p>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      render: (c: Customer) => (
        <Badge variant={TYPE_VARIANT[c.type]}>{TYPE_LABELS[c.type]}</Badge>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (c: Customer) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {c.phone ? formatPhone(c.phone) : '—'}
        </span>
      ),
    },
    {
      key: 'address',
      header: 'Address',
      render: (c: Customer) => (
        <span className="text-xs text-muted-foreground max-w-[180px] block truncate">
          {c.address ?? '—'}
        </span>
      ),
    },
    {
      key: 'last_ordered',
      header: 'Last Order',
      sortable: true,
      render: (c: Customer) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {c.last_ordered_at ? formatDate(c.last_ordered_at + 'T00:00:00') : '—'}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      sortable: true,
      render: (c: Customer) => {
        const bal = c.total_balance ?? 0
        return bal > 0 ? (
          <span className={cn('text-xs font-medium', 'text-destructive')}>
            {formatCurrency(bal)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )
      },
    },
    {
      key: 'actions',
      header: (
        <div className="flex items-center justify-end">
          <button type="button" title="Export to Excel" onClick={onExport}
            className="text-muted-foreground hover:text-foreground transition-colors duration-150">
            <Download className="h-4 w-4" />
          </button>
        </div>
      ),
      render: (c: Customer) => isOwner ? (
        <div className="flex items-center justify-end">
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(c) }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : null,
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={sorted}
      rowKey={(c) => c.id}
      onRowClick={onView}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={handleSort}
      emptyState={
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No customers yet"
          description="Add your first customer to start tracking sales and payments."
        />
      }
    />
  )
}

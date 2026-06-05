import { useState } from 'react'
import { Package, Minus, Plus, Pencil, Trash2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { SearchInput } from '@/components/shared/SearchInput'
import { formatDate } from '@/lib/utils'
import { computeStatus } from '../hooks/useSupplies'
import type { Supply, SupplyStatus } from '../types'
import type { Column } from '@/components/shared/DataTable'

const STATUS_VARIANT: Record<SupplyStatus, 'success' | 'outline' | 'destructive'> = {
  in_stock:     'success',
  low_stock:    'outline',
  out_of_stock: 'destructive',
}

const STATUS_LABEL: Record<SupplyStatus, string> = {
  in_stock:     'In Stock',
  low_stock:    'Low',
  out_of_stock: 'Out',
}

const STATUS_ORDER: Record<SupplyStatus, number> = {
  out_of_stock: 0,
  low_stock:    1,
  in_stock:     2,
}

type SortKey = 'name' | 'qty' | 'last_purchased_at' | 'status'

const SEARCH_THRESHOLD = 10

interface SupplyTableProps {
  items:         Supply[]
  isLoading:     boolean
  productNames:  Record<string, string>
  onEditClick:   (item: Supply) => void
  onDeleteClick: (item: Supply) => void
  onQuickAdjust: (item: Supply, delta: number) => void
}

export function SupplyTable({
  items,
  isLoading,
  productNames,
  onEditClick,
  onDeleteClick,
  onQuickAdjust,
}: SupplyTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [search, setSearch]   = useState('')

  const handleSort = (key: string) => {
    const k = key as SortKey
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setSortDir('asc') }
  }

  const filtered = search.length >= 3
    ? items.filter((i) =>
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        (i.store ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : items

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    switch (sortKey) {
      case 'name':              cmp = a.name.localeCompare(b.name); break
      case 'qty':               cmp = a.qty - b.qty; break
      case 'last_purchased_at': cmp = (a.last_purchased_at ?? '').localeCompare(b.last_purchased_at ?? ''); break
      case 'status':            cmp = STATUS_ORDER[computeStatus(a.qty, a.threshold)] - STATUS_ORDER[computeStatus(b.qty, b.threshold)]; break
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const hasLowStock = items.some((i) => computeStatus(i.qty, i.threshold) !== 'in_stock')

  const columns: Column<Supply>[] = [
    {
      key: 'name',
      header: 'Item',
      sortable: true,
      render: (item) => {
        const linkedName = item.linked_product_id ? productNames[item.linked_product_id] : null
        return (
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">{item.name}</p>
            {linkedName && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 pt-0.5">
                <ArrowRight className="h-3 w-3 shrink-0" />
                {linkedName} · {item.units_per_sale}/sale
              </p>
            )}
          </div>
        )
      },
    },
    {
      key: 'last_purchased_at',
      header: 'Last Purchase',
      sortable: true,
      render: (item) => (
        <div className="space-y-0.5">
          <p className="text-sm text-foreground">
            {item.last_purchased_at ? formatDate(item.last_purchased_at) : '—'}
          </p>
          <p className="text-xs text-muted-foreground">{item.store ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (item) => {
        const status = computeStatus(item.qty, item.threshold)
        return (
          <div className="space-y-1">
            <Badge variant={STATUS_VARIANT[status]} className="text-xs">
              {STATUS_LABEL[status]}
            </Badge>
            {item.threshold > 0 && (
              <p className="text-xs text-muted-foreground">Low: {item.threshold}</p>
            )}
          </div>
        )
      },
    },
    {
      key: 'qty',
      header: 'Qty',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7 shrink-0"
            onClick={(e) => { e.stopPropagation(); onQuickAdjust(item, -1) }}
            disabled={item.qty <= 0}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-8 text-center text-sm font-bold text-foreground">{item.qty}</span>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7 shrink-0"
            onClick={(e) => { e.stopPropagation(); onQuickAdjust(item, 1) }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (item) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onEditClick(item) }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDeleteClick(item) }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  if (isLoading) return <LoadingSkeleton rows={4} />

  return (
    <div className="space-y-4">
      {hasLowStock && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3">
          <Package className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">Some items are running low or out of stock.</p>
        </div>
      )}

      {items.length > SEARCH_THRESHOLD && (
        <SearchInput onSearch={(q) => setSearch(q)} placeholder="Search items or store…" />
      )}

      <DataTable
        columns={columns}
        data={sorted}
        rowKey={(item) => item.id}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        rowClassName={(item) => {
          const status = computeStatus(item.qty, item.threshold)
          if (status === 'out_of_stock') return 'bg-destructive/5'
          if (status === 'low_stock') return 'bg-yellow-50 dark:bg-yellow-950/20'
          return ''
        }}
        emptyState={
          <EmptyState
            icon={<Package className="h-8 w-8" />}
            title="No items yet"
            description="Add an item, then log purchases via Expenses → Supplies."
          />
        }
      />
    </div>
  )
}

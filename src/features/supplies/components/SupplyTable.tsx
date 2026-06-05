import { useState } from 'react'
import { Package, Minus, Plus, Receipt, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { SearchInput } from '@/components/shared/SearchInput'
import { formatCurrency, formatDate } from '@/lib/utils'
import { computeStatus } from '../hooks/useSupplies'
import type { Supply, SupplyStatus } from '../types'
import type { Column } from '@/components/shared/DataTable'

const STATUS_VARIANT: Record<SupplyStatus, 'success' | 'outline' | 'destructive'> = {
  in_stock:      'success',
  low_stock:     'outline',
  out_of_stock:  'destructive',
}

const STATUS_LABEL: Record<SupplyStatus, string> = {
  in_stock:      'In Stock',
  low_stock:     'Low',
  out_of_stock:  'Out',
}

type SortKey = 'name' | 'qty' | 'price_per_unit' | 'total_value' | 'store' | 'last_purchased_at'

const SEARCH_THRESHOLD = 10

interface SupplyTableProps {
  items:           Supply[]
  isLoading:       boolean
  onEditClick:     (item: Supply) => void
  onDeleteClick:   (item: Supply) => void
  onQuickAdjust:   (item: Supply, delta: number) => void
  onLogAsExpense:  (item: Supply) => void
}

export function SupplyTable({
  items,
  isLoading,
  onEditClick,
  onDeleteClick,
  onQuickAdjust,
  onLogAsExpense,
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
      case 'price_per_unit':    cmp = (a.price_per_unit ?? 0) - (b.price_per_unit ?? 0); break
      case 'total_value':       cmp = (a.qty * (a.price_per_unit ?? 0)) - (b.qty * (b.price_per_unit ?? 0)); break
      case 'store':             cmp = (a.store ?? '').localeCompare(b.store ?? ''); break
      case 'last_purchased_at': cmp = (a.last_purchased_at ?? '').localeCompare(b.last_purchased_at ?? ''); break
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const hasLowStock = items.some((i) => computeStatus(i.qty, i.threshold) !== 'in_stock')

  const columns: Column<Supply>[] = [
    {
      key: 'name',
      header: 'Item',
      sortable: true,
      render: (item) => (
        <p className="text-sm font-medium text-foreground">{item.name}</p>
      ),
    },
    {
      key: 'price_per_unit',
      header: 'Price/pc',
      sortable: true,
      render: (item) => (
        <span className="text-sm text-foreground">
          {item.price_per_unit != null ? formatCurrency(item.price_per_unit) : '—'}
        </span>
      ),
    },
    {
      key: 'total_value',
      header: 'Total Value',
      sortable: true,
      render: (item) => (
        <span className="text-sm text-foreground">
          {item.price_per_unit != null ? formatCurrency(item.qty * item.price_per_unit) : '—'}
        </span>
      ),
    },
    {
      key: 'store',
      header: 'Store',
      sortable: true,
      render: (item) => (
        <span className="text-sm text-muted-foreground">{item.store ?? '—'}</span>
      ),
    },
    {
      key: 'last_purchased_at',
      header: 'Last Purchased',
      sortable: true,
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.last_purchased_at ? formatDate(item.last_purchased_at) : '—'}
        </span>
      ),
    },
    {
      key: 'qty',
      header: 'Qty',
      sortable: true,
      render: (item) => {
        const status = computeStatus(item.qty, item.threshold)
        return (
          <div className="flex items-center gap-2">
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
            <Badge variant={STATUS_VARIANT[status]} className="text-xs hidden md:inline-flex">
              {STATUS_LABEL[status]}
            </Badge>
          </div>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      render: (item) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs gap-1"
            onClick={(e) => { e.stopPropagation(); onLogAsExpense(item) }}
            title="Log purchase as expense"
          >
            <Receipt className="h-3 w-3" />
            <span className="hidden sm:inline">Expense</span>
          </Button>
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
        <SearchInput
          onSearch={(q) => setSearch(q)}
          placeholder="Search items or store…"
        />
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
            description="Add your first supply item."
          />
        }
      />
    </div>
  )
}

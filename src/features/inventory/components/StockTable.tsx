import { useState } from 'react'
import { Package, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import type { InventoryItem, StockStatus } from '../types'

const STATUS_VARIANT: Record<StockStatus, 'success' | 'outline' | 'destructive'> = {
  in_stock: 'success',
  low_stock: 'outline',
  out_of_stock: 'destructive',
}

const STATUS_LABELS: Record<StockStatus, string> = {
  in_stock: 'In Stock',
  low_stock: 'Low',
  out_of_stock: 'Out',
}

type SortKey = 'name' | 'qty'
type SortDir = 'asc' | 'desc'

interface StockTableProps {
  items: InventoryItem[]
  isLoading: boolean
  onAdjustClick: (item: InventoryItem) => void
  onQuickAdjust: (item: InventoryItem, delta: number) => void
  columnOrder?: string[]
  onColumnReorder?: (order: string[]) => void
}

export function StockTable({ items, isLoading, onAdjustClick, onQuickAdjust, columnOrder, onColumnReorder }: StockTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (key: string) => {
    const k = key as SortKey
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(k)
      setSortDir('asc')
    }
  }

  const sorted = [...items].sort((a, b) => {
    const cmp = sortKey === 'name'
      ? a.product_name.localeCompare(b.product_name)
      : a.available_qty - b.available_qty
    return sortDir === 'asc' ? cmp : -cmp
  })

  const hasLowStock = items.some((i) => i.status !== 'in_stock')

  const columns = [
    {
      key: 'name',
      header: 'Product',
      sortable: true,
      render: (item: InventoryItem) => (
        <div>
          <p className="text-sm font-medium text-foreground">{item.product_name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Threshold: {item.threshold}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: InventoryItem) => (
        <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_LABELS[item.status]}</Badge>
      ),
    },
    {
      key: 'qty',
      header: 'Qty',
      sortable: true,
      render: (item: InventoryItem) => (
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onQuickAdjust(item, -1) }}
            disabled={item.available_qty <= 0}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <button
            type="button"
            className="w-10 text-center text-sm font-bold text-foreground hover:text-primary transition-colors duration-150"
            onClick={(e) => { e.stopPropagation(); onAdjustClick(item) }}
          >
            {item.available_qty}
          </button>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onQuickAdjust(item, 1) }}
          >
            <Plus className="h-3 w-3" />
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

      <DataTable
        tableId="inventory"
        columns={columns}
        data={sorted}
        rowKey={(item) => item.id}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        externalColumnOrder={columnOrder}
        onColumnReorder={onColumnReorder}
        rowClassName={(item) => {
          if (item.status === 'out_of_stock') return 'bg-destructive/5'
          if (item.status === 'low_stock') return 'bg-yellow-50 dark:bg-yellow-950/20'
          return ''
        }}
        emptyState={
          <EmptyState
            icon={<Package className="h-8 w-8" />}
            title="No inventory items"
            description="Add products in Settings to start tracking stock."
          />
        }
      />
    </div>
  )
}

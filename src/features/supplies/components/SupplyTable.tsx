import { useState } from 'react'
import { Package, Minus, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/shared/DataTable'
import type { ColumnConfig } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { formatDate, cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { computeStatus } from '../hooks/useSupplies'
import type { Supply, SupplyStatus } from '../types'

// Lower number = shown first (out/low before in_stock)
const STATUS_ORDER: Record<SupplyStatus, number> = {
  out_of_stock: 0,
  low_stock:    1,
  in_stock:     2,
}

type SortKey = 'name' | 'store' | 'linked_product' | 'qty' | 'last_purchased_at' | 'status'

export const SUPPLY_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'name',              label: 'Item' },
  { key: 'store',             label: 'Supplier' },
  { key: 'linked_product',    label: 'Used For' },
  { key: 'last_purchased_at', label: 'Last Purchase' },
  { key: 'qty',               label: 'Stock' },
]

interface SupplyTableProps {
  items:         Supply[]
  isLoading:     boolean
  productNames:  Record<string, string>
  onEditClick:   (item: Supply) => void
  onDeleteClick: (item: Supply) => void
  onQuickAdjust: (item: Supply, delta: number) => void
  hiddenKeys?:   Set<string>
  columnWidths?: Record<string, number>
  onColumnResize?: (key: string, width: number) => void
  columnOrder?: string[]
  onColumnReorder?: (order: string[]) => void
}

export function SupplyTable({
  items,
  isLoading,
  productNames,
  onEditClick,
  onDeleteClick,
  onQuickAdjust,
  hiddenKeys,
  columnWidths,
  onColumnResize,
  columnOrder,
  onColumnReorder,
}: SupplyTableProps) {
  const role    = useAuthStore((s) => s.role)
  const isOwner = role === 'owner' || role === 'super_admin'

  // Default: low/out-of-stock items first, then in-stock by most qty
  const [sortKey, setSortKey] = useState<SortKey>('status')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (key: string) => {
    const k = key as SortKey
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setSortDir('asc') }
  }

  const sorted = [...items].sort((a, b) => {
    let cmp = 0
    switch (sortKey) {
      case 'name':              cmp = a.name.localeCompare(b.name); break
      case 'store':             cmp = (a.store ?? '').localeCompare(b.store ?? ''); break
      case 'linked_product':    cmp = (productNames[a.linked_product_id ?? ''] ?? '').localeCompare(productNames[b.linked_product_id ?? ''] ?? ''); break
      case 'qty':               cmp = a.qty - b.qty; break
      case 'last_purchased_at': cmp = (a.last_purchased_at ?? '').localeCompare(b.last_purchased_at ?? ''); break
      case 'status': {
        const sa = STATUS_ORDER[computeStatus(a.qty, a.threshold)]
        const sb = STATUS_ORDER[computeStatus(b.qty, b.threshold)]
        if (sa !== sb) { cmp = (sortDir === 'asc' ? 1 : -1) * (sa - sb); return cmp }
        // Same status group — alert items: fewest first (most urgent); in-stock: most first
        const aIsAlert = sa < 2
        return aIsAlert ? a.qty - b.qty : b.qty - a.qty
      }
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const hasLowStock = items.some((i) => computeStatus(i.qty, i.threshold) !== 'in_stock')

  // ── Tablet/desktop DataTable columns ──────────────────────────────────────
  const columns = [
    {
      key: 'name',
      header: 'Item',
      sortable: true,
      render: (item: Supply) => (
        <p className="text-sm font-semibold text-foreground">{item.name}</p>
      ),
    },
    {
      key: 'store',
      header: 'Supplier',
      sortable: true,
      className: 'hidden md:table-cell',
      render: (item: Supply) => (
        <span className="text-sm text-muted-foreground">{item.store ?? '—'}</span>
      ),
    },
    {
      key: 'linked_product',
      header: 'Used For',
      sortable: true,
      className: 'hidden lg:table-cell w-36',
      render: (item: Supply) => {
        const junctionNames =
          item.supply_product_links && item.supply_product_links.length > 0
            ? item.supply_product_links.map((l) => productNames[l.product_id]).filter(Boolean)
            : item.linked_product_id
            ? [productNames[item.linked_product_id]].filter(Boolean)
            : []
        if (junctionNames.length === 0) return <span className="text-sm text-muted-foreground">—</span>
        return (
          <div className="flex flex-col gap-0.5">
            {junctionNames.map((name, i) => (
              <span key={i} className="text-sm text-muted-foreground">{name}</span>
            ))}
          </div>
        )
      },
    },
    {
      key: 'last_purchased_at',
      header: 'Last Purchase',
      sortable: true,
      className: 'hidden lg:table-cell w-32',
      render: (item: Supply) => (
        <span className="text-sm text-foreground">
          {item.last_purchased_at ? formatDate(item.last_purchased_at) : '—'}
        </span>
      ),
    },
    {
      // qty number + ± adjust buttons, then Low: X threshold below
      key: 'qty',
      header: 'Stock',
      sortable: true,
      className: 'w-44',
      render: (item: Supply) => (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            {isOwner && (
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7 shrink-0"
                onClick={(e) => { e.stopPropagation(); onQuickAdjust(item, -1) }}
                disabled={item.qty <= 0}
              >
                <Minus className="h-3 w-3" />
              </Button>
            )}
            <span className="text-sm font-bold text-foreground">{item.qty}</span>
            {isOwner && (
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7 shrink-0"
                onClick={(e) => { e.stopPropagation(); onQuickAdjust(item, 1) }}
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
          </div>
          <span className="text-xs text-muted-foreground">Low: {item.threshold}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-16',
      render: (item: Supply) => (
        <div className="flex items-center gap-1 justify-end">
          {isOwner && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDeleteClick(item) }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  if (isLoading) return <LoadingSkeleton rows={4} />

  const emptyNode = (
    <EmptyState
      icon={<Package className="h-8 w-8" />}
      title="No items yet"
      description="Add an item, then log purchases via Expenses → Supplies."
    />
  )

  return (
    <div className="space-y-4">
      {hasLowStock && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3">
          <Package className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">Some items are running low or out of stock.</p>
        </div>
      )}

      {/* ── Mobile card list (< md) ─────────────────────────────────────── */}
      <div className="md:hidden">
        {sorted.length === 0 ? emptyNode : (
          <div className="space-y-2">
            {sorted.map((item) => {
              const status = computeStatus(item.qty, item.threshold)
              return (
                <div
                  key={item.id}
                  className={cn(
                    'rounded-lg border border-border px-4 py-3',
                    isOwner && 'cursor-pointer active:bg-accent/50',
                    status === 'out_of_stock' && 'bg-destructive/5',
                    status === 'low_stock'    && 'bg-yellow-50 dark:bg-yellow-950/20',
                    status === 'in_stock'     && 'bg-card',
                  )}
                  onClick={isOwner ? () => onEditClick(item) : undefined}
                >
                  {/* Row 1: name + delete */}
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{item.name}</p>
                      {item.store && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.store}</p>
                      )}
                    </div>
                    {isOwner && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive shrink-0 -mt-0.5 -mr-1"
                        onClick={(e) => { e.stopPropagation(); onDeleteClick(item) }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Row 2: qty + ± controls + Low:X */}
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1.5">
                      {isOwner && (
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7 shrink-0"
                          onClick={(e) => { e.stopPropagation(); onQuickAdjust(item, -1) }}
                          disabled={item.qty <= 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                      )}
                      <span className="text-sm font-bold text-foreground min-w-[1.5rem] text-center">{item.qty}</span>
                      {isOwner && (
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7 shrink-0"
                          onClick={(e) => { e.stopPropagation(); onQuickAdjust(item, 1) }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">Low: {item.threshold}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Tablet / Desktop table (≥ md) ──────────────────────────────── */}
      <div className="hidden md:block">
        <DataTable
          tableId="supplies"
          fitViewport
          columns={columns}
          data={sorted}
          rowKey={(item) => item.id}
          onRowClick={isOwner ? onEditClick : undefined}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          hiddenKeys={hiddenKeys}
          columnWidths={columnWidths}
          onColumnResize={onColumnResize}
          externalColumnOrder={columnOrder}
          onColumnReorder={onColumnReorder}
          rowClassName={(item) => {
            const status = computeStatus(item.qty, item.threshold)
            if (status === 'out_of_stock') return 'bg-destructive/5'
            if (status === 'low_stock') return 'bg-yellow-50 dark:bg-yellow-950/20'
            return ''
          }}
          emptyState={emptyNode}
        />
      </div>
    </div>
  )
}

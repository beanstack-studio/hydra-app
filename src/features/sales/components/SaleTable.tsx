import { useState } from 'react'
import { ShoppingCart, Trash2 } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import type { ColumnConfig } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import type { Sale, SaleStatus, OrderType, PaymentMode } from '../types'

type SaleSortKey = 'date' | 'customer' | 'amount' | 'order_type' | 'payment' | 'status'
type SortDir = 'asc' | 'desc'

const statusOrder: Record<SaleStatus, number> = { unpaid: 0, partial: 1, paid: 2 }

const statusVariant: Record<SaleStatus, 'success' | 'destructive' | 'outline'> = {
  paid: 'success',
  partial: 'outline',
  unpaid: 'destructive',
}

const orderTypeLabel: Record<OrderType, string> = {
  'walk-in': 'Walk-in',
  delivery: 'Delivery',
  pickup: 'Pickup',
}

const paymentLabel: Record<PaymentMode, string> = {
  cash: 'Cash',
  gcash: 'GCash',
  maya: 'Maya',
  utang: 'Utang',
}

export const SALE_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'date',       label: 'Date' },
  { key: 'customer',   label: 'Customer' },
  { key: 'order_type', label: 'Type' },
  { key: 'product',    label: 'Product' },
  { key: 'payment',    label: 'Payment' },
  { key: 'amount',     label: 'Amount' },
  { key: 'status',     label: 'Status' },
  { key: 'remarks',    label: 'Remarks' },
]

interface SaleTableProps {
  sales: Sale[]
  onSelect: (sale: Sale) => void
  onPay?: (sale: Sale) => void
  onDelete?: (sale: Sale) => void
  hiddenKeys?: Set<string>
  columnWidths?: Record<string, number>
  onColumnResize?: (key: string, width: number) => void
}

export function SaleTable({
  sales,
  onSelect,
  onPay,
  onDelete,
  hiddenKeys,
  columnWidths,
  onColumnResize,
}: SaleTableProps) {
  const [sortKey, setSortKey] = useState<SaleSortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: string) => {
    const k = key as SaleSortKey
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(k)
      setSortDir('asc')
    }
  }

  const sorted = [...sales].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'date')       cmp = a.sale_date.localeCompare(b.sale_date)
    if (sortKey === 'customer')   cmp = a.customer_name.localeCompare(b.customer_name)
    if (sortKey === 'amount')     cmp = a.total_amount - b.total_amount
    if (sortKey === 'order_type') cmp = a.order_type.localeCompare(b.order_type)
    if (sortKey === 'payment')    cmp = a.payment_mode.localeCompare(b.payment_mode)
    if (sortKey === 'status')     cmp = statusOrder[a.status] - statusOrder[b.status]
    return sortDir === 'asc' ? cmp : -cmp
  })

  const columns = [
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (s: Sale) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(s.sale_date)}</span>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      sortable: true,
      render: (s: Sale) => (
        <p className="font-medium text-sm">{s.customer_name}</p>
      ),
    },
    {
      key: 'order_type',
      header: 'Type',
      sortable: true,
      render: (s: Sale) => (
        <span className="text-xs text-muted-foreground">{orderTypeLabel[s.order_type]}</span>
      ),
    },
    {
      key: 'product',
      header: 'Product',
      render: (s: Sale) => {
        const productLines: string[] = s.items && s.items.length > 0
          ? s.items.map((item) => `${item.product_name} ×${item.qty}`)
          : [`${s.product_name} ×${s.qty}`]
        if (s.container_enabled && s.container_qty > 0) {
          productLines.push(`Container ×${s.container_qty}`)
        }
        return (
          <div className="flex flex-col gap-0.5">
            {productLines.map((line, i) => (
              <span key={i} className="text-xs text-muted-foreground whitespace-nowrap">{line}</span>
            ))}
          </div>
        )
      },
    },
    {
      key: 'payment',
      header: 'Payment',
      sortable: true,
      render: (s: Sale) => (
        <span className="text-xs text-muted-foreground">{paymentLabel[s.payment_mode]}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (s: Sale) => (
        <span className={cn('text-sm font-medium', s.status !== 'paid' && 'text-destructive')}>
          {formatCurrency(s.total_amount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (s: Sale) => (
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant[s.status]}>
            {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
          </Badge>
          {s.status !== 'paid' && onPay && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-xs"
              onClick={(e) => { e.stopPropagation(); onPay(s) }}
            >
              Pay
            </Button>
          )}
        </div>
      ),
    },
    {
      key: 'remarks',
      header: 'Remarks',
      render: (s: Sale) => (
        <span className="text-xs text-muted-foreground">{s.remarks ?? '—'}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (s: Sale) => onDelete ? (
        <div className="flex justify-end">
          <button
            type="button"
            title="Delete sale"
            onClick={(e) => { e.stopPropagation(); onDelete(s) }}
            className="text-muted-foreground hover:text-destructive transition-colors duration-150 p-1"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null,
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={sorted}
      rowKey={(s) => s.id}
      onRowClick={onSelect}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={handleSort}
      hiddenKeys={hiddenKeys}
      columnWidths={columnWidths}
      onColumnResize={onColumnResize}
      emptyState={
        <EmptyState
          icon={<ShoppingCart className="h-8 w-8" />}
          title="No sales yet"
          description="Record your first sale to get started."
        />
      }
    />
  )
}

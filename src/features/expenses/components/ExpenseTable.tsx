import { useState } from 'react'
import { Receipt, Pencil, Trash2, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import type { ColumnConfig } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import type { Expense, ExpenseCategory, ExpensePaymentMethod } from '../types'

type ExpenseSortKey = 'date' | 'amount' | 'category' | 'item' | 'qty' | 'supplier' | 'price_per_unit' | 'payment'
type SortDir = 'asc' | 'desc'

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  labor:       'Payroll',
  gasoline:    'Gasoline',
  supplies:    'Supplies',
  maintenance: 'Maintenance',
  other:       'Other',
}

const PAYMENT_LABELS: Record<ExpensePaymentMethod, string> = {
  cash:        'Cash',
  gcash:       'GCash',
  maya:        'Maya',
  credit_card: 'Credit Card',
  other:       'Other',
}

export const EXPENSE_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'date',          label: 'Date' },
  { key: 'category',      label: 'Category' },
  { key: 'item',          label: 'Item' },
  { key: 'qty',           label: 'Qty' },
  { key: 'supplier',      label: 'Supplier' },
  { key: 'price_per_unit', label: 'Price/Unit' },
  { key: 'payment',       label: 'Via' },
  { key: 'amount',        label: 'Total Price' },
  { key: 'remarks',       label: 'Remarks' },
]

interface ExpenseTableProps {
  expenses: Expense[]
  onEdit: (expense: Expense) => void
  onDelete: (expense: Expense) => void
  onViewReceipt: (expense: Expense) => void
  onPay: (expense: Expense) => void
  hiddenKeys?: Set<string>
  columnWidths?: Record<string, number>
  onColumnResize?: (key: string, width: number) => void
}

export function ExpenseTable({
  expenses,
  onEdit,
  onDelete,
  onViewReceipt,
  onPay,
  hiddenKeys,
  columnWidths,
  onColumnResize,
}: ExpenseTableProps) {
  const isOwner = useAuthStore((s) => s.role) === 'owner'
  const [sortKey, setSortKey] = useState<ExpenseSortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: string) => {
    const k = key as ExpenseSortKey
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setSortDir('asc') }
  }

  const sorted = [...expenses].sort((a, b) => {
    let cmp = 0
    switch (sortKey) {
      case 'date':          cmp = a.expense_date.localeCompare(b.expense_date); break
      case 'amount':        cmp = a.amount - b.amount; break
      case 'category':      cmp = a.category.localeCompare(b.category); break
      case 'item':          cmp = (a.item ?? '').localeCompare(b.item ?? ''); break
      case 'qty':           cmp = (a.qty ?? 0) - (b.qty ?? 0); break
      case 'supplier':      cmp = (a.supplier ?? '').localeCompare(b.supplier ?? ''); break
      case 'price_per_unit': {
        const ppuA = a.qty && a.qty > 0 ? a.amount / a.qty : 0
        const ppuB = b.qty && b.qty > 0 ? b.amount / b.qty : 0
        cmp = ppuA - ppuB; break
      }
      case 'payment':       cmp = (a.payment_method ?? '').localeCompare(b.payment_method ?? ''); break
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const columns = [
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (e: Expense) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(e.expense_date)}</span>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      render: (e: Expense) => (
        <Badge variant="outline">{CATEGORY_LABELS[e.category]}</Badge>
      ),
    },
    {
      key: 'item',
      header: 'Item',
      sortable: true,
      render: (e: Expense) => (
        <span className="text-sm text-foreground">{e.item || '—'}</span>
      ),
    },
    {
      key: 'qty',
      header: 'Qty',
      sortable: true,
      render: (e: Expense) => (
        <span className="text-sm text-muted-foreground">{e.qty != null ? e.qty : '—'}</span>
      ),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      sortable: true,
      render: (e: Expense) => (
        <span className="text-sm text-muted-foreground">{e.supplier ?? '—'}</span>
      ),
    },
    {
      key: 'price_per_unit',
      header: 'Price/Unit',
      sortable: true,
      render: (e: Expense) => {
        const ppu = e.qty && e.qty > 0 ? e.amount / e.qty : null
        return (
          <span className="text-sm text-muted-foreground">
            {ppu != null ? formatCurrency(ppu) : '—'}
          </span>
        )
      },
    },
    {
      key: 'payment',
      header: 'Via',
      sortable: true,
      render: (e: Expense) => (
        <span className="text-xs text-muted-foreground">
          {e.payment_method ? PAYMENT_LABELS[e.payment_method] : '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Total Price',
      sortable: true,
      render: (e: Expense) => (
        <span className="text-sm font-semibold">{formatCurrency(e.amount)}</span>
      ),
    },
    {
      key: 'remarks',
      header: 'Remarks',
      render: (e: Expense) => (
        <span className="text-xs text-muted-foreground">{e.remarks ?? '—'}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (e: Expense) => (
        <div className="flex items-center gap-1 justify-end">
          {!e.payment_method && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={(ev) => { ev.stopPropagation(); onPay(e) }}
            >
              Pay
            </Button>
          )}
          {e.receipt_url && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground"
              title="View receipt"
              onClick={(ev) => { ev.stopPropagation(); onViewReceipt(e) }}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          )}
          {isOwner && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={(ev) => { ev.stopPropagation(); onEdit(e) }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {isOwner && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={(ev) => { ev.stopPropagation(); onDelete(e) }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <DataTable
      tableId="expenses"
      columns={columns}
      data={sorted}
      rowKey={(e) => e.id}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={handleSort}
      hiddenKeys={hiddenKeys}
      columnWidths={columnWidths}
      onColumnResize={onColumnResize}
      emptyState={
        <EmptyState
          icon={<Receipt className="h-8 w-8" />}
          title="No expenses yet"
          description="Record your first expense to start tracking costs."
        />
      }
    />
  )
}

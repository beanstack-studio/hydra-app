import { useState } from 'react'
import { Receipt, Pencil, Trash2, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Expense, ExpenseCategory, ExpensePaymentMethod } from '../types'

type ExpenseSortKey = 'date' | 'amount' | 'category'
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

interface ExpenseTableProps {
  expenses: Expense[]
  onEdit: (expense: Expense) => void
  onDelete: (expense: Expense) => void
  onViewReceipt: (expense: Expense) => void
  onPay: (expense: Expense) => void
}

export function ExpenseTable({ expenses, onEdit, onDelete, onViewReceipt, onPay }: ExpenseTableProps) {
  const [sortKey, setSortKey] = useState<ExpenseSortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: string) => {
    const k = key as ExpenseSortKey
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(k)
      setSortDir('asc')
    }
  }

  const sorted = [...expenses].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'date')     cmp = a.expense_date.localeCompare(b.expense_date)
    if (sortKey === 'amount')   cmp = a.amount - b.amount
    if (sortKey === 'category') cmp = a.category.localeCompare(b.category)
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
      key: 'payment',
      header: 'Via',
      render: (e: Expense) => (
        <span className="text-xs text-muted-foreground">
          {e.payment_method ? PAYMENT_LABELS[e.payment_method] : '—'}
        </span>
      ),
    },
    {
      key: 'remarks',
      header: 'Remarks',
      render: (e: Expense) => (
        <span className="text-sm text-muted-foreground">{e.remarks ?? '—'}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (e: Expense) => (
        <span className="text-sm font-semibold">{formatCurrency(e.amount)}</span>
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
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={(ev) => { ev.stopPropagation(); onEdit(e) }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={(ev) => { ev.stopPropagation(); onDelete(e) }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={sorted}
      rowKey={(e) => e.id}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={handleSort}
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

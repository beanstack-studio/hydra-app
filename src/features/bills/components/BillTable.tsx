import { useState } from 'react'
import { FileText, Plus, Pencil, Trash2, CreditCard } from 'lucide-react'
import { useTablePrefs } from '@/hooks/useTablePrefs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/shared/Modal'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { DataTable } from '@/components/shared/DataTable'
import type { Column } from '@/components/shared/DataTable'
import { TableOptionsButton } from '@/components/shared/TableOptionsButton'
import type { FilterGroup } from '@/components/shared/FilterButton'
import { BillModal } from './BillModal'
import { PayBillModal } from './PayBillModal'
import { formatCurrency, formatExportAmount, formatDate, nowPH } from '@/lib/utils'
import type { ExportColumnDef } from '@/components/shared/ExportModal'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/stores/authStore'
import { useBills } from '../hooks/useBills'
import type { Bill } from '../types'

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash:        'Cash',
  gcash:       'GCash',
  maya:        'Maya',
  credit_card: 'Credit Card',
  other:       'Other',
}

const BILL_TYPE_OPTIONS = [
  { value: 'electricity', label: 'Electricity' },
  { value: 'water',       label: 'Water'       },
  { value: 'internet',    label: 'Internet'    },
  { value: 'rent',        label: 'Rent'        },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other',       label: 'Other'       },
]


const BILLS_EXPORT_COLUMNS: ExportColumnDef[] = [
  { key: 'type',        label: 'Type'        },
  { key: 'due_date',    label: 'Due Date',    defaultChecked: false },
  { key: 'amount',      label: 'Amount'      },
  { key: 'status',      label: 'Status'      },
  { key: 'date_paid',   label: 'Date Paid'   },
  { key: 'description', label: 'Description', defaultChecked: false },
]

type BillSortKey = 'type' | 'due_date' | 'status' | 'amount'
type SortDir = 'asc' | 'desc'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const BILL_TYPE_LABELS: Record<string, string> = {
  electricity: 'Electricity',
  water:       'Water',
  internet:    'Internet',
  rent:        'Rent',
  other:       'Other',
  maintenance: 'Maintenance',
}

export function BillTable() {
  const { toast } = useToast()
  const isOwner = useAuthStore((s) => s.role) === 'owner'
  const { hiddenKeys, toggleColumn, columnWidths, onColumnResize } = useTablePrefs('bills', ['description'])
  const { data, isLoading, error, month, year, setMonth, setYear, addBill, updateBill, deleteBill, payBill } = useBills()

  const currentYear = nowPH().getFullYear()
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1]

  const billFilterGroups: FilterGroup[] = [
    {
      key: 'month',
      label: 'Month',
      options: MONTHS.map((m, i) => ({ value: String(i + 1), label: m })),
    },
    {
      key: 'year',
      label: 'Year',
      options: yearOptions.map((y) => ({ value: String(y), label: String(y) })),
    },
    {
      key: 'type',
      label: 'Type',
      options: BILL_TYPE_OPTIONS,
    },
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'unpaid', label: 'Unpaid' },
        { value: 'paid',   label: 'Paid'   },
      ],
    },
    {
      key: 'payment_method',
      label: 'Payment Method',
      options: [
        { value: 'cash',        label: 'Cash'        },
        { value: 'gcash',       label: 'GCash'       },
        { value: 'maya',        label: 'Maya'        },
        { value: 'credit_card', label: 'Credit Card' },
        { value: 'other',       label: 'Other'       },
      ],
    },
  ]

  const [editingBill,  setEditingBill]  = useState<Bill | null>(null)
  const [isFormOpen,   setIsFormOpen]   = useState(false)
  const [deletingBill, setDeletingBill] = useState<Bill | null>(null)
  const [isDeleting,   setIsDeleting]   = useState(false)
  const [payingBill,   setPayingBill]   = useState<Bill | null>(null)
  const [billFilters,  setBillFilters]  = useState<Record<string, string>>({})
  const [sortKey,      setSortKey]      = useState<BillSortKey>('due_date')
  const [sortDir,      setSortDir]      = useState<SortDir>('asc')

  const handleBillFilterChange = (key: string, val: string) => {
    if (key === 'month') {
      setMonth(val ? Number(val) : nowPH().getMonth() + 1)
    } else if (key === 'year') {
      setYear(val ? Number(val) : currentYear)
    } else {
      setBillFilters((prev) => ({ ...prev, [key]: val }))
    }
  }

  const handleBillFilterReset = () => {
    setBillFilters({})
    setMonth(nowPH().getMonth() + 1)
    setYear(currentYear)
  }

  const handleSort = (key: string) => {
    const k = key as BillSortKey
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(k)
      setSortDir('asc')
    }
  }

  const filteredData = data.filter((b) => {
    if (billFilters.type && b.bill_type !== billFilters.type) return false
    if (billFilters.status) {
      const isPaid = !!b.date_paid
      if (billFilters.status === 'paid'   && !isPaid) return false
      if (billFilters.status === 'unpaid' &&  isPaid) return false
    }
    if (billFilters.payment_method && b.payment_method !== billFilters.payment_method) return false
    return true
  })

  const sorted = [...filteredData].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'type')   cmp = a.bill_type.localeCompare(b.bill_type)
    if (sortKey === 'status') cmp = Number(!!a.date_paid) - Number(!!b.date_paid)
    if (sortKey === 'amount') cmp = a.amount - b.amount
    if (sortKey === 'due_date') {
      if (!a.due_date && !b.due_date) cmp = 0
      else if (!a.due_date) return 1
      else if (!b.due_date) return -1
      else cmp = a.due_date.localeCompare(b.due_date)
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const handleDelete = async () => {
    if (!deletingBill) return
    setIsDeleting(true)
    try {
      await deleteBill(deletingBill.id)
      toast({ title: 'Bill deleted' })
      setDeletingBill(null)
    } catch (e) {
      toast({ title: 'Delete failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  // Export rows from filtered + sorted data only
  const billExportRows = sorted.map((b) => ({
    type:      BILL_TYPE_LABELS[b.bill_type] ?? b.bill_type,
    due_date:  b.due_date ? formatDate(b.due_date) : '',
    amount:    formatExportAmount(b.amount),
    status:    b.date_paid ? 'Paid' : 'Unpaid',
    date_paid: b.date_paid ? formatDate(b.date_paid) : '',
    description: b.description ?? '',
  }))

  const columns: Column<Bill>[] = [
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      render: (bill) => (
        <span className="text-sm font-medium">{BILL_TYPE_LABELS[bill.bill_type]}</span>
      ),
    },
    {
      key: 'due_date',
      header: 'Due Date',
      sortable: true,
      render: (bill) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {bill.due_date ? formatDate(bill.due_date) : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (bill) => (
        bill.date_paid
          ? <Badge variant="success">Paid</Badge>
          : <Badge variant="destructive">Unpaid</Badge>
      ),
    },
    {
      key: 'date_paid',
      header: 'Date Paid',
      render: (bill) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {bill.date_paid ? formatDate(bill.date_paid) : '—'}
        </span>
      ),
    },
    {
      key: 'payment_method',
      header: 'Via',
      render: (bill) => (
        <span className="text-xs text-muted-foreground">
          {bill.payment_method ? PAYMENT_METHOD_LABELS[bill.payment_method] : '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (bill) => (
        <span className="text-sm font-semibold">{formatCurrency(bill.amount)}</span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (bill) => (
        <span className="text-xs text-muted-foreground">{bill.description ?? '—'}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (bill) => (
        <div className="flex items-center gap-1 justify-end">
          {!bill.date_paid && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={(e) => { e.stopPropagation(); setPayingBill(bill) }}
            >
              <CreditCard className="h-3.5 w-3.5 mr-1" />
              Pay
            </Button>
          )}
          {isOwner && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={(e) => { e.stopPropagation(); setEditingBill(bill); setIsFormOpen(true) }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {isOwner && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); setDeletingBill(bill) }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  if (isLoading) return <LoadingSkeleton rows={4} />

  return (
    <div className="space-y-4 w-full">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Options + Add */}
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground">
          {MONTHS[month - 1]} {year}
        </p>
        <div className="ml-auto flex items-center gap-3">
          <TableOptionsButton
            filterGroups={billFilterGroups}
            filterValue={{ ...billFilters, month: String(month), year: String(year) }}
            onFilterChange={handleBillFilterChange}
            onFilterReset={handleBillFilterReset}
            uncountedFilterKeys={['month', 'year']}
            hiddenKeys={hiddenKeys}
            onToggleColumn={toggleColumn}
            exportColumns={BILLS_EXPORT_COLUMNS}
            exportRows={billExportRows}
            exportFilename={`hydra-bills-${MONTHS[month - 1]}-${year}`}
            exportTitle="Bills"
          />
          {isOwner && (
            <Button size="sm" onClick={() => { setEditingBill(null); setIsFormOpen(true) }}>
              <Plus className="h-4 w-4 mr-1" />
              Add Bill
            </Button>
          )}
        </div>
      </div>

      <DataTable
        tableId="bills"
        columns={columns}
        data={sorted}
        rowKey={(bill) => bill.id}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        hiddenKeys={hiddenKeys}
        columnWidths={columnWidths}
        onColumnResize={onColumnResize}
        emptyState={
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="No bills this month"
            description="Add electricity, water, internet or rent bills."
          />
        }
      />

      <BillModal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingBill(null) }}
        bill={editingBill}
        month={month}
        year={year}
        onAdd={addBill}
        onUpdate={updateBill}
      />

      <Modal isOpen={!!deletingBill} onClose={() => setDeletingBill(null)} title="Delete Bill" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Delete this <span className="font-semibold text-foreground">{BILL_TYPE_LABELS[deletingBill?.bill_type ?? '']}</span> bill? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setDeletingBill(null)}>Cancel</Button>
            <Button type="button" variant="destructive" className="flex-1" disabled={isDeleting} onClick={handleDelete}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>

      <PayBillModal
        bill={payingBill}
        isOpen={!!payingBill}
        onClose={() => setPayingBill(null)}
        onPay={async (id, date) => {
          await payBill(id, date)
          setPayingBill(null)
          toast({ title: 'Bill marked as paid' })
        }}
      />
    </div>
  )
}

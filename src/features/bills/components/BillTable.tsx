import { useState } from 'react'
import { FileText, Plus, Pencil, Trash2, CreditCard, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/shared/Modal'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { DataTable } from '@/components/shared/DataTable'
import type { Column } from '@/components/shared/DataTable'
import { BillModal } from './BillModal'
import { PayBillModal } from './PayBillModal'
import { formatCurrency, formatDate, nowPH } from '@/lib/utils'
import { ExportModal, type ExportColumnDef } from '@/components/shared/ExportModal'

const BILLS_EXPORT_COLUMNS: ExportColumnDef[] = [
  { key: 'type',      label: 'Type' },
  { key: 'due_date',  label: 'Due Date' },
  { key: 'amount',    label: 'Amount' },
  { key: 'status',    label: 'Status' },
  { key: 'date_paid', label: 'Date Paid' },
  { key: 'remarks',   label: 'Remarks', defaultChecked: false },
]
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/stores/authStore'
import { useBills } from '../hooks/useBills'
import type { Bill } from '../types'

type BillSortKey = 'type' | 'due_date' | 'status' | 'amount'
type SortDir = 'asc' | 'desc'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const BILL_TYPE_LABELS: Record<string, string> = {
  electricity: 'Electricity',
  water: 'Water',
  internet: 'Internet',
  rent: 'Rent',
  other: 'Other',
  maintenance: 'Maintenance',
}

export function BillTable() {
  const { toast } = useToast()
  const isOwner = useAuthStore((s) => s.role) === 'owner'
  const { data, isLoading, error, month, year, setMonth, setYear, addBill, updateBill, deleteBill, payBill } = useBills()

  const [editingBill, setEditingBill] = useState<Bill | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [deletingBill, setDeletingBill] = useState<Bill | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [payingBill,   setPayingBill]   = useState<Bill | null>(null)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [sortKey, setSortKey] = useState<BillSortKey>('due_date')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (key: string) => {
    const k = key as BillSortKey
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(k)
      setSortDir('asc')
    }
  }

  const sorted = [...data].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'type') cmp = a.bill_type.localeCompare(b.bill_type)
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

  const billExportRows = data.map((b) => ({
    type:      BILL_TYPE_LABELS[b.bill_type] ?? b.bill_type,
    due_date:  b.due_date ? formatDate(b.due_date) : '',
    amount:    formatCurrency(b.amount),
    status:    b.date_paid ? 'Paid' : 'Unpaid',
    date_paid: b.date_paid ? formatDate(b.date_paid) : '',
    remarks:   b.remarks ?? '',
  }))

  const currentYear = nowPH().getFullYear()
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1]

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
        <div className="space-y-0.5">
          {bill.date_paid
            ? <Badge variant="success">Paid</Badge>
            : <Badge variant="destructive">Unpaid</Badge>
          }
          {bill.date_paid && (
            <p className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(bill.date_paid)}</p>
          )}
        </div>
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
      key: 'actions',
      header: (
        <div className="flex items-center justify-end">
          <button type="button" title="Export" onClick={() => setIsExportOpen(true)}
            className="text-muted-foreground hover:text-foreground transition-colors duration-150">
            <Download className="h-4 w-4" />
          </button>
        </div>
      ),
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

      {/* Month / year picker + Add */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {isOwner && (
          <Button size="sm" className="ml-auto" onClick={() => { setEditingBill(null); setIsFormOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" />
            Add Bill
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={sorted}
        rowKey={(bill) => bill.id}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        emptyState={
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="No bills this month"
            description="Add electricity, water, internet or rent bills."
          />
        }
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        title="Bills"
        filename={`hydra-bills-${MONTHS[month - 1]}-${year}`}
        columns={BILLS_EXPORT_COLUMNS}
        rows={billExportRows}
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

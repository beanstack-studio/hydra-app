import { useState } from 'react'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/shared/Modal'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { ExpenseModal } from '@/features/expenses/components/ExpenseModal'
import { ExpenseTable } from '@/features/expenses/components/ExpenseTable'
import { BillTable } from '@/features/bills/components/BillTable'
import { PayrollSection } from '@/features/payroll/components/PayrollSection'
import { useExpenses } from '@/features/expenses/hooks/useExpenses'
import { useSupplies } from '@/features/supplies/hooks/useSupplies'
import { SearchInput } from '@/components/shared/SearchInput'
import { formatCurrency, formatExportAmount, formatDate, cn } from '@/lib/utils'
import type { ExportColumnDef } from '@/components/shared/ExportModal'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/stores/authStore'
import { usePlan } from '@/hooks/usePlan'
import type { FilterGroup } from '@/components/shared/FilterButton'
import { TableOptionsButton } from '@/components/shared/TableOptionsButton'
import { useTablePrefs } from '@/hooks/useTablePrefs'
import type { Expense, ExpensePaymentMethod } from '@/features/expenses/types'

const EXPENSE_STATIC_FILTER_GROUPS: FilterGroup[] = [
  {
    key: 'category',
    label: 'Category',
    options: [
      { value: 'supplies',    label: 'Supplies'    },
      { value: 'gasoline',    label: 'Gasoline'    },
      { value: 'maintenance', label: 'Maintenance' },
      { value: 'other',       label: 'Other'       },
    ],
  },
  {
    key: 'payment_status',
    label: 'Payment Status',
    options: [
      { value: 'paid',   label: 'Paid'   },
      { value: 'unpaid', label: 'Unpaid' },
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

type Tab = 'expenses' | 'bills' | 'payroll'

const EXPENSE_EXPORT_COLUMNS: ExportColumnDef[] = [
  { key: 'date',           label: 'Date' },           // visible
  { key: 'category',       label: 'Category' },       // visible
  { key: 'item',           label: 'Item' },           // visible
  { key: 'qty',            label: 'Qty' },            // visible
  { key: 'price_per_unit', label: 'Price/Unit' },     // visible
  { key: 'supplier',       label: 'Supplier' },       // visible
  { key: 'total_price',    label: 'Total Price' },    // visible
  { key: 'payment_method', label: 'Payment Method' }, // visible (Via)
  { key: 'remarks',        label: 'Remarks',         defaultChecked: false },
]

export default function ExpensesPage() {
  const { toast } = useToast()
  const role    = useAuthStore((s) => s.role)
  const { hiddenKeys, toggleColumn, columnWidths, onColumnResize, columnOrder, onColumnReorder, filterValues: expenseFilters, setFilterValues: setExpenseFilters } = useTablePrefs('expenses', ['remarks'])
  const plan    = usePlan()
  const isOwner = role === 'owner'
  const isFree  = plan === 'free'
  const [activeTab,      setActiveTab]      = useState<Tab>('expenses')
  const [expenseSearch,  setExpenseSearch]  = useState('')
  const [isModalOpen,   setIsModalOpen]   = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [payingExpense, setPayingExpense] = useState<Expense | null>(null)
  const [payMethod, setPayMethod] = useState<ExpensePaymentMethod | ''>('')
  const [isPaying, setIsPaying] = useState(false)

  const { data, isLoading, error, addExpense, updateExpense, deleteExpense, markExpensePaid, getReceiptUrl } = useExpenses()
  const { data: supplies } = useSupplies()

  const openEdit = (expense: Expense) => {
    setEditingExpense(expense)
    setIsModalOpen(true)
  }

  const openDelete = (expense: Expense) => setDeletingExpense(expense)

  const handlePay = async () => {
    if (!payingExpense || !payMethod) return
    setIsPaying(true)
    try {
      await markExpensePaid(payingExpense.id, payMethod as ExpensePaymentMethod)
      toast({ title: 'Expense marked as paid' })
      setPayingExpense(null)
      setPayMethod('')
    } catch (e) {
      toast({ title: 'Failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setIsPaying(false)
    }
  }

  const handleViewReceipt = async (expense: Expense) => {
    if (!expense.receipt_url) return
    try {
      const url = await getReceiptUrl(expense.receipt_url)
      window.open(url, '_blank')
    } catch {
      toast({ title: 'Could not load receipt', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!deletingExpense) return
    setIsDeleting(true)
    try {
      await deleteExpense(deletingExpense.id)
      toast({ title: 'Expense deleted' })
      setDeletingExpense(null)
    } catch (e) {
      toast({ title: 'Delete failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  const ALL_EXPENSE_TABS: { id: Tab; label: string; ownerOnly?: boolean }[] = [
    { id: 'expenses', label: 'General' },
    { id: 'bills',    label: 'Bills' },
    { id: 'payroll',  label: 'Payroll', ownerOnly: true },
  ]
  const TABS = ALL_EXPENSE_TABS.filter((t) => !t.ownerOnly || isOwner)

  // Staff see only one-off expense categories (no labor/payroll rows)
  const baseExpenses = data.filter((e) => e.category !== 'labor')

  const uniqueExpenseSuppliers = [...new Set(
    baseExpenses.map((e) => e.supplier).filter(Boolean)
  )] as string[]

  const expenseFilterGroups: FilterGroup[] = [
    ...EXPENSE_STATIC_FILTER_GROUPS,
    ...(uniqueExpenseSuppliers.length > 0 ? [{
      key: 'supplier',
      label: 'Supplier',
      options: uniqueExpenseSuppliers.map((s) => ({ value: s, label: s })),
    }] : []),
  ]

  const visibleExpenses = baseExpenses
    .filter((e) => {
      if (expenseFilters.category && e.category !== expenseFilters.category) return false
      if (expenseFilters.payment_status) {
        const isPaid = !!e.payment_method
        if (expenseFilters.payment_status === 'paid'   && !isPaid) return false
        if (expenseFilters.payment_status === 'unpaid' &&  isPaid) return false
      }
      if (expenseFilters.payment_method && e.payment_method !== expenseFilters.payment_method) return false
      if (expenseFilters.supplier       && e.supplier        !== expenseFilters.supplier)       return false
      return true
    })
    .filter((e) =>
      expenseSearch.length >= 3
        ? e.item.toLowerCase().includes(expenseSearch.toLowerCase()) ||
          (e.supplier ?? '').toLowerCase().includes(expenseSearch.toLowerCase()) ||
          e.category.toLowerCase().includes(expenseSearch.toLowerCase())
        : true
    )

  const expenseExportRows = visibleExpenses.map((e) => ({
    date:           formatDate(e.expense_date),
    category:       e.category,
    item:           e.item,
    qty:            e.qty ?? '',
    price_per_unit: e.qty && e.qty > 0 ? formatExportAmount(e.amount / e.qty) : '',
    supplier:       e.supplier ?? '',
    total_price:    formatExportAmount(e.amount),
    payment_method: e.payment_method ?? '',
    remarks:        e.remarks ?? '',
  }))

  return (
    <div>
      <PageHeader title="Expenses" />

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {/* Tabs */}
      <div className="flex border-b border-border mb-0 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-none px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all duration-150 whitespace-nowrap',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-6">
        {activeTab === 'expenses' ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <SearchInput
                onSearch={setExpenseSearch}
                placeholder="Search item, supplier, category…"
                className="flex-1"
              />
              <TableOptionsButton
                filterGroups={expenseFilterGroups}
                filterValue={expenseFilters}
                onFilterChange={(key, val) => setExpenseFilters({ ...expenseFilters, [key]: val })}
                onFilterReset={() => setExpenseFilters({})}
                hiddenKeys={hiddenKeys}
                onToggleColumn={toggleColumn}
                exportColumns={isFree ? undefined : EXPENSE_EXPORT_COLUMNS}
                exportRows={isFree ? undefined : expenseExportRows}
                exportFilename="hydra-expenses"
                exportTitle="Expenses"
              />
              <Button size="sm" onClick={() => { setEditingExpense(null); setIsModalOpen(true) }}>
                <Plus className="h-4 w-4 mr-1" />
                Add Expense
              </Button>
            </div>
            {isLoading ? (
              <LoadingSkeleton rows={5} />
            ) : (
              <ExpenseTable
                expenses={visibleExpenses}
                onEdit={openEdit}
                onDelete={openDelete}
                onViewReceipt={(e) => { void handleViewReceipt(e) }}
                onPay={(e) => { setPayingExpense(e); setPayMethod('') }}
                hiddenKeys={hiddenKeys}
                columnWidths={columnWidths}
                onColumnResize={onColumnResize}
                columnOrder={columnOrder}
                onColumnReorder={onColumnReorder}
              />
            )}
          </>
        ) : activeTab === 'bills' ? (
          <BillTable />
        ) : (
          <PayrollSection />
        )}
      </div>


      <ExpenseModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingExpense(null) }}
        expense={editingExpense}
        supplies={supplies}
        onAdd={addExpense}
        onUpdate={updateExpense}
      />

      {/* ── Pay expense modal ─────────────────────────────────────────────── */}
      <Modal
        isOpen={!!payingExpense}
        onClose={() => { setPayingExpense(null); setPayMethod('') }}
        title="Record Payment"
        size="sm"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{payingExpense?.item}</p>
              <p className="text-sm font-bold">{formatCurrency(payingExpense?.amount ?? 0)}</p>
            </div>
            {payingExpense?.remarks && (
              <p className="text-xs text-muted-foreground">{payingExpense.remarks}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none">Payment Method <span className="text-destructive">*</span></label>
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value as ExpensePaymentMethod | '')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">— Select —</option>
              <option value="cash">Cash</option>
              <option value="gcash">GCash</option>
              <option value="maya">Maya</option>
              <option value="credit_card">Credit Card</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => { setPayingExpense(null); setPayMethod('') }}>
              Cancel
            </Button>
            <Button type="button" className="flex-1" disabled={!payMethod || isPaying} onClick={() => { void handlePay() }}>
              {isPaying ? 'Saving…' : 'Confirm Payment'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!deletingExpense} onClose={() => setDeletingExpense(null)} title="Delete Expense" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Delete this expense of{' '}
            <span className="font-semibold text-foreground">{formatCurrency(deletingExpense?.amount ?? 0)}</span>?
            This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setDeletingExpense(null)}>Cancel</Button>
            <Button type="button" variant="destructive" className="flex-1" disabled={isDeleting} onClick={handleDelete}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

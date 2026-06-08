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
import { formatCurrency, formatDate, downloadCSV, cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/stores/authStore'
import type { Expense, ExpensePaymentMethod } from '@/features/expenses/types'

type Tab = 'expenses' | 'bills' | 'payroll'

export default function ExpensesPage() {
  const { toast } = useToast()
  const role    = useAuthStore((s) => s.role)
  const isOwner = role === 'owner'
  const [activeTab,      setActiveTab]      = useState<Tab>('expenses')
  const [expenseSearch,  setExpenseSearch]  = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
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

  const handleExportExpenses = () => {
    downloadCSV(
      `hydra-expenses-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Date', 'Category', 'Item', 'Qty', 'Price/Unit', 'Supplier', 'Total Price', 'Payment Method'],
      data.filter((e) => e.category !== 'labor').map((e) => [
        formatDate(e.expense_date),
        e.category,
        e.item,
        e.qty ?? '',
        e.qty && e.qty > 0 ? formatCurrency(e.amount / e.qty) : '',
        e.supplier ?? '',
        formatCurrency(e.amount),
        e.payment_method ?? '',
      ])
    )
  }

  // Staff see only one-off expense categories (no labor/payroll rows)
  const baseExpenses = data.filter((e) => e.category !== 'labor')
  const visibleExpenses = expenseSearch.length >= 3
    ? baseExpenses.filter((e) =>
        e.item.toLowerCase().includes(expenseSearch.toLowerCase()) ||
        (e.supplier ?? '').toLowerCase().includes(expenseSearch.toLowerCase()) ||
        e.category.toLowerCase().includes(expenseSearch.toLowerCase())
      )
    : baseExpenses

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
                onExport={handleExportExpenses}
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

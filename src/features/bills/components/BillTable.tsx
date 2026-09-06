import { useState } from 'react'
import { FileText, Plus, Trash2, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/shared/Modal'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { BillModal } from './BillModal'
import { PayBillModal } from './PayBillModal'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
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

const BILL_TYPE_LABELS: Record<string, string> = {
  electricity: 'Electricity',
  water:       'Water',
  internet:    'Internet',
  rent:        'Rent',
  other:       'Other',
  maintenance: 'Maintenance',
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface BillGroup {
  key: string
  label: string
  month: number
  year: number
  bills: Bill[]
  total: number
}

function groupBillsByMonth(bills: Bill[]): BillGroup[] {
  const map = new Map<string, BillGroup>()
  for (const b of bills) {
    const key = `${b.year}-${String(b.month).padStart(2, '0')}`
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: `${MONTHS[b.month - 1]} ${b.year}`,
        month: b.month,
        year:  b.year,
        bills: [],
        total: 0,
      })
    }
    const group = map.get(key)!
    group.bills.push(b)
    group.total += b.amount
  }
  // Already sorted desc by hook (year desc, month desc)
  return Array.from(map.values())
}

export function BillTable() {
  const { toast } = useToast()
  const isOwner = useAuthStore((s) => s.role) === 'owner'
  const { data, isLoading, error, addBill, updateBill, deleteBill, payBill } = useBills()

  const [editingBill,  setEditingBill]  = useState<Bill | null>(null)
  const [isFormOpen,   setIsFormOpen]   = useState(false)
  const [deletingBill, setDeletingBill] = useState<Bill | null>(null)
  const [isDeleting,   setIsDeleting]   = useState(false)
  const [payingBill,   setPayingBill]   = useState<Bill | null>(null)

  const groups = groupBillsByMonth(data)

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

  const thClass = 'px-3 py-2 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap'
  const tdClass = 'px-3 py-2 text-sm align-middle'

  if (isLoading) return <LoadingSkeleton rows={4} />

  return (
    <div className="space-y-4 w-full">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Add button */}
      {isOwner && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { setEditingBill(null); setIsFormOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" />
            Add Bill
          </Button>
        </div>
      )}

      {groups.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No bills yet"
          description="Add electricity, water, internet or rent bills."
        />
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className={thClass}>Type</th>
                <th className={thClass}>Due Date</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Date Paid</th>
                <th className={thClass}>Via</th>
                <th className={thClass}>Amount</th>
                <th className={thClass}></th>
              </tr>
            </thead>
            {groups.map(({ key, label, bills, total }, groupIdx) => (
              <tbody key={key}>
                {/* Month group header row */}
                <tr className={cn(groupIdx > 0 && 'border-t-2 border-border')}>
                  <td colSpan={7} className="px-3 py-2 bg-muted/20">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-foreground">{label}</span>
                      <span className="text-xs text-muted-foreground">{formatCurrency(total)}</span>
                    </div>
                  </td>
                </tr>
                {bills.map((bill, idx) => (
                  <tr
                    key={bill.id}
                    onClick={isOwner ? () => { setEditingBill(bill); setIsFormOpen(true) } : undefined}
                    className={cn(
                      'border-b border-border last:border-0 transition-colors duration-150',
                      isOwner && 'cursor-pointer hover:bg-muted/40',
                      idx % 2 === 1 && 'bg-muted/10',
                    )}
                  >
                    <td className={tdClass}>
                      <span className="font-medium">{BILL_TYPE_LABELS[bill.bill_type] ?? bill.bill_type}</span>
                      {bill.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[160px]">{bill.description}</p>
                      )}
                    </td>
                    <td className={tdClass}>
                      <span className="text-muted-foreground whitespace-nowrap">
                        {bill.due_date ? formatDate(bill.due_date) : '—'}
                      </span>
                    </td>
                    <td className={tdClass}>
                      {bill.date_paid
                        ? <Badge variant="success">Paid</Badge>
                        : <Badge variant="destructive">Unpaid</Badge>
                      }
                    </td>
                    <td className={tdClass}>
                      <span className="text-muted-foreground whitespace-nowrap">
                        {bill.date_paid ? formatDate(bill.date_paid) : '—'}
                      </span>
                    </td>
                    <td className={tdClass}>
                      <span className="text-muted-foreground">
                        {bill.payment_method ? PAYMENT_METHOD_LABELS[bill.payment_method] : '—'}
                      </span>
                    </td>
                    <td className={tdClass}>
                      <span className="font-semibold">{formatCurrency(bill.amount)}</span>
                    </td>
                    <td className={tdClass}>
                      <div
                        className="flex items-center gap-1 justify-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!bill.date_paid && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-primary hover:text-primary"
                            title="Mark as paid"
                            onClick={() => setPayingBill(bill)}
                          >
                            <CreditCard className="h-4 w-4" />
                          </Button>
                        )}
                        {isOwner && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeletingBill(bill)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}

      <BillModal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingBill(null) }}
        bill={editingBill}
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

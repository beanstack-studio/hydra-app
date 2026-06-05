import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, MessageSquare, MapPin, ShoppingCart, Pencil, CreditCard, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { DataTable } from '@/components/shared/DataTable'
import type { Column } from '@/components/shared/DataTable'
import { RecordPaymentModal } from '@/features/sales/components/RecordPaymentModal'
import { CustomerModal } from '@/features/customers/components/CustomerModal'
import { useCustomerProfile } from '@/features/customers/hooks/useCustomerProfile'
import { formatCurrency, formatDate, formatPhone, cn } from '@/lib/utils'

type OrderSortKey = 'date' | 'order_type' | 'amount' | 'status'
type SortDir = 'asc' | 'desc'

const STATUS_ORDER: Record<string, number> = { unpaid: 0, partial: 1, paid: 2 }
import type { SaleWithPayments, SaleStatus, PaymentMode } from '@/features/sales/types'
import type { CustomerType } from '@/features/customers/types'

const TYPE_LABELS: Record<CustomerType, string> = {
  walk_in: 'Walk-in',
  regular: 'Regular',
  retailer: 'Retailer',
}

const STATUS_VARIANT: Record<SaleStatus, 'success' | 'outline' | 'destructive'> = {
  paid: 'success',
  partial: 'outline',
  unpaid: 'destructive',
}

const ORDER_TYPE_LABEL: Record<string, string> = {
  'walk-in': 'Walk-in',
  delivery: 'Delivery',
  pickup: 'Pickup',
}


export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { customer, sales, isLoading, error, recordPayment, updateCustomer } = useCustomerProfile(id)
  const [payingSale, setPayingSale] = useState<SaleWithPayments | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [sortKey, setSortKey] = useState<OrderSortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: string) => {
    const k = key as OrderSortKey
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(k)
      setSortDir('asc')
    }
  }

  const sortedSales = [...sales].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'date') cmp = a.sale_date.localeCompare(b.sale_date)
    if (sortKey === 'order_type') cmp = a.order_type.localeCompare(b.order_type)
    if (sortKey === 'amount') cmp = a.total_amount - b.total_amount
    if (sortKey === 'status') cmp = (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const orderHistoryColumns: Column<SaleWithPayments>[] = [
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (sale) => (
        <div>
          <p className="text-sm font-medium whitespace-nowrap">{formatDate(sale.sale_date)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{sale.product_name} ×{sale.qty}</p>
        </div>
      ),
    },
    {
      key: 'order_type',
      header: 'Order Type',
      sortable: true,
      render: (sale) => (
        <Badge variant="outline">{ORDER_TYPE_LABEL[sale.order_type] ?? sale.order_type}</Badge>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (sale) => (
        <div>
          <p className="text-sm font-semibold">{formatCurrency(sale.total_amount)}</p>
          {sale.balance_due > 0 && (
            <p className="text-xs font-semibold text-destructive whitespace-nowrap">
              Bal: {formatCurrency(sale.balance_due)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (sale) => (
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[sale.status]}>
            {sale.status.charAt(0).toUpperCase() + sale.status.slice(1)}
          </Badge>
          {sale.status !== 'paid' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={(e) => { e.stopPropagation(); setPayingSale(sale) }}
            >
              <CreditCard className="h-3.5 w-3.5 mr-1" />
              Pay
            </Button>
          )}
        </div>
      ),
    },
  ]

  const handlePayment = async (
    saleId: string,
    amount: number,
    paymentMode: PaymentMode,
    paidAt: string,
    remarks: string,
  ) => {
    await recordPayment(saleId, amount, paymentMode, paidAt, remarks)
  }

  const totalSpent = sales.reduce((sum, s) => sum + s.total_amount, 0)
  const totalBalance = sales.reduce((sum, s) => sum + s.balance_due, 0)

  return (
    <div>
      {/* Back button */}
      <div className="mb-5">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/customers')}
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Customers
        </Button>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <LoadingSkeleton rows={8} />
      ) : !customer ? (
        <EmptyState
          icon={<User className="h-8 w-8" />}
          title="Customer not found"
          description="This customer may have been deleted."
        />
      ) : (
        <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-10 space-y-6 lg:space-y-0">

          {/* ── Left column: customer info + stats ── */}
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-foreground leading-tight">{customer.name}</h1>
                <Badge variant="outline" className="mt-2">{TYPE_LABELS[customer.type]}</Badge>
              </div>
              <Button size="sm" variant="outline" className="shrink-0 mt-1" onClick={() => setIsEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
            </div>

            <div className="space-y-2">
              {customer.phone && (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{formatPhone(customer.phone)}</span>
                </div>
              )}
              {customer.messenger && (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span>{customer.messenger}</span>
                </div>
              )}
              {customer.address && (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>{customer.address}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">Total Spent</p>
                <p className="text-xl font-bold text-foreground mt-0.5">{formatCurrency(totalSpent)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{sales.length} orders</p>
              </div>
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">Balance Due</p>
                <p className={cn('text-xl font-bold mt-0.5', totalBalance > 0 ? 'text-destructive' : 'text-foreground')}>
                  {formatCurrency(totalBalance)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {totalBalance > 0 ? 'Unsettled' : 'All clear'}
                </p>
              </div>
            </div>
          </div>

          {/* ── Right column: order history ── */}
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
              Order History
            </h2>

            <DataTable
              columns={orderHistoryColumns}
              data={sortedSales}
              rowKey={(sale) => sale.id}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              emptyState={
                <EmptyState
                  icon={<ShoppingCart className="h-8 w-8" />}
                  title="No orders yet"
                  description="Sales will appear here once recorded."
                />
              }
            />
          </div>
        </div>
      )}

      <RecordPaymentModal
        sale={payingSale}
        isOpen={!!payingSale}
        onClose={() => setPayingSale(null)}
        onRecord={handlePayment}
      />

      {customer && (
        <CustomerModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          customer={customer}
          onAdd={async () => { /* edit mode only — onAdd never called */ }}
          onUpdate={updateCustomer}
        />
      )}
    </div>
  )
}

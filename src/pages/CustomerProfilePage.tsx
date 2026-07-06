import { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, MessageSquare, MapPin, ShoppingCart, Pencil, CreditCard, User, Printer } from 'lucide-react'
import { formatInTimeZone } from 'date-fns-tz'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { DataTable } from '@/components/shared/DataTable'
import type { Column } from '@/components/shared/DataTable'
import { RecordPaymentModal } from '@/features/sales/components/RecordPaymentModal'
import { CustomerModal } from '@/features/customers/components/CustomerModal'
import { TableOptionsButton } from '@/components/shared/TableOptionsButton'
import type { ExportColumnDef } from '@/components/shared/ExportModal'
import { useCustomerProfile } from '@/features/customers/hooks/useCustomerProfile'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, formatDate, formatExportAmount, formatPhone, PH_TZ, cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useTablePrefs } from '@/hooks/useTablePrefs'

const ORDER_HISTORY_EXPORT_COLUMNS: ExportColumnDef[] = [
  { key: 'date',        label: 'Date' },
  { key: 'order_no',    label: 'Order #' },
  { key: 'product',     label: 'Product',     defaultChecked: false },
  { key: 'qty',         label: 'Qty',         defaultChecked: false },
  { key: 'order_type',  label: 'Order Type' },
  { key: 'total',       label: 'Total' },
  { key: 'balance_due', label: 'Balance Due', defaultChecked: false },
  { key: 'status',      label: 'Status' },
  { key: 'payment',     label: 'Payment',     defaultChecked: false },
]

type OrderSortKey = 'date' | 'order_type' | 'amount' | 'status'
type SortDir = 'asc' | 'desc'
type BulkPayMode = 'cash' | 'gcash' | 'maya'

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

const BULK_PAY_MODES: { value: BulkPayMode; label: string }[] = [
  { value: 'cash',  label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'maya',  label: 'Transfer' },
]

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const role    = useAuthStore((s) => s.role)
  const isOwner = role === 'owner' || role === 'super_admin'
  const { customer, sales, isLoading, error, recordPayment, recordBulkPayment, updateCustomer } = useCustomerProfile(id)

  // ── Sort state ────────────────────────────────────────────────────────────
  const [payingSale,  setPayingSale]  = useState<SaleWithPayments | null>(null)
  const [isEditOpen,  setIsEditOpen]  = useState(false)
  const [sortKey,     setSortKey]     = useState<OrderSortKey>('date')
  const [sortDir,     setSortDir]     = useState<SortDir>('desc')

  // ── Bulk payment state ────────────────────────────────────────────────────
  const [selectionMode,    setSelectionMode]    = useState(false)
  const [selectedIds,      setSelectedIds]      = useState<Set<string>>(new Set())
  const [bulkPayMode,      setBulkPayMode]      = useState<BulkPayMode>('cash')
  const [isBulkPaying,     setIsBulkPaying]     = useState(false)
  const [bulkAmountInput,  setBulkAmountInput]  = useState(0)

  const handleSort = (key: string) => {
    const k = key as OrderSortKey
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setSortDir('asc') }
  }

  const sortedSales = [...sales].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'date')       cmp = a.sale_date.localeCompare(b.sale_date)
    if (sortKey === 'order_type') cmp = a.order_type.localeCompare(b.order_type)
    if (sortKey === 'amount')     cmp = a.total_amount - b.total_amount
    if (sortKey === 'status')     cmp = (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0)
    return sortDir === 'asc' ? cmp : -cmp
  })

  // Sales eligible for bulk payment
  const bulkableSales  = sales.filter((s) => s.status !== 'paid')
  const hasBulkable    = bulkableSales.length > 0
  const paidSales      = sales.filter((s) => s.status === 'paid')

  const isAndroid = /Android/i.test(navigator.userAgent)
  const printScheme = isAndroid ? 'my.bluetoothprint.scheme://' : 'bprint://'
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '')
  const printStatementUrl = paidSales.length > 0
    ? `${printScheme}${supabaseUrl}/functions/v1/bulk-receipt?sale_ids=${paidSales.map((s) => s.id).join(',')}`
    : null
  const selectedSales     = bulkableSales.filter((s) => selectedIds.has(s.id))
  const bulkTotal         = selectedSales.reduce((sum, s) => sum + s.balance_due, 0)
  const allSelected       = bulkableSales.length > 0 && selectedIds.size === bulkableSales.length
  const bulkBalance       = Math.max(0, bulkTotal - bulkAmountInput)
  const bulkIsOverpayment = bulkAmountInput > bulkTotal && bulkTotal > 0

  // Auto-fill payment amount whenever selection changes
  useEffect(() => {
    setBulkAmountInput(bulkTotal)
  }, [bulkTotal])

  const handleBulkAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseFloat(e.target.value)
    setBulkAmountInput(isNaN(parsed) ? 0 : parsed)
  }, [])

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setBulkAmountInput(0)
  }, [])

  const handleToggle = useCallback((saleId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(saleId)
      else next.delete(saleId)
      return next
    })
  }, [])

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) setSelectedIds(new Set(bulkableSales.map((s) => s.id)))
    else setSelectedIds(new Set())
  }, [bulkableSales])

  const handleBulkPayment = async () => {
    if (selectedIds.size === 0 || bulkAmountInput <= 0) return
    setIsBulkPaying(true)
    try {
      const paidAt = formatInTimeZone(new Date(), PH_TZ, 'yyyy-MM-dd')
      const cappedAmount = Math.min(bulkAmountInput, bulkTotal)

      // Pre-compute how many orders will be fully settled (for toast message)
      const sortedSelected = [...selectedSales].sort((a, b) => a.sale_date.localeCompare(b.sale_date))
      let remaining = cappedAmount
      let settledCount = 0
      for (const sale of sortedSelected) {
        if (remaining <= 0) break
        if (remaining >= sale.balance_due) settledCount++
        remaining -= Math.min(remaining, sale.balance_due)
      }

      await recordBulkPayment(Array.from(selectedIds), cappedAmount, bulkPayMode, paidAt)
      toast({
        title: `${formatCurrency(cappedAmount)} paid`,
        description: settledCount < selectedIds.size
          ? `${settledCount} of ${selectedIds.size} orders fully settled`
          : `${settledCount} ${settledCount === 1 ? 'order' : 'orders'} settled`,
      })
      exitSelectionMode()
    } catch (e) {
      toast({
        title: 'Bulk payment failed',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    } finally {
      setIsBulkPaying(false)
    }
  }

  const { hiddenKeys, toggleColumn } = useTablePrefs('customer-order-history', [])

  // ── Export rows ───────────────────────────────────────────────────────────
  const orderHistoryExportRows = sortedSales.map((s) => ({
    date:        formatDate(s.sale_date),
    order_no:    `#${s.id.slice(-6).toUpperCase()}`,
    product:     s.product_name,
    qty:         s.qty,
    order_type:  ORDER_TYPE_LABEL[s.order_type] ?? s.order_type,
    total:       formatExportAmount(s.total_amount),
    balance_due: s.balance_due > 0 ? formatExportAmount(s.balance_due) : '',
    status:      s.status.charAt(0).toUpperCase() + s.status.slice(1),
    payment:     s.payment_mode ?? '',
  }))

  // ── Columns ───────────────────────────────────────────────────────────────
  const checkboxColumn: Column<SaleWithPayments> = {
    key: 'checkbox',
    header: '',
    render: (sale) => {
      if (sale.status === 'paid') return null
      return (
        <input
          type="checkbox"
          checked={selectedIds.has(sale.id)}
          onChange={(e) => handleToggle(sale.id, e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
        />
      )
    },
  }

  const baseColumns: Column<SaleWithPayments>[] = [
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (sale) => (
        <p className="text-sm font-medium whitespace-nowrap">{formatDate(sale.sale_date)}</p>
      ),
    },
    {
      key: 'order_no',
      header: 'Order #',
      render: (sale) => (
        <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
          #{sale.id.slice(-6).toUpperCase()}
        </span>
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
          {!selectionMode && sale.status !== 'paid' && (
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

  const activeColumns: Column<SaleWithPayments>[] = selectionMode
    ? [checkboxColumn, ...baseColumns]
    : baseColumns

  const handlePayment = async (
    saleId: string,
    amount: number,
    paymentMode: PaymentMode,
    paidAt: string,
    remarks: string,
  ) => {
    await recordPayment(saleId, amount, paymentMode, paidAt, remarks)
  }

  const totalSpent   = sales.reduce((sum, s) => sum + s.total_amount, 0)
  const totalBalance = sales.reduce((sum, s) => sum + s.balance_due, 0)

  const pillBase    = 'flex-1 rounded-md py-1.5 text-xs font-medium border transition-all duration-150'
  const pillActive  = 'bg-primary text-primary-foreground border-primary'
  const pillInactive = 'bg-background text-muted-foreground border-border hover:bg-accent'

  const bulkAmountDisplayValue: string | number = bulkAmountInput === 0 ? '' : bulkAmountInput

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
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="outline">{TYPE_LABELS[customer.type]}</Badge>
                  {customer.type === 'retailer' && <Badge variant="outline" className="text-primary border-primary/40">Retailer</Badge>}
                </div>
              </div>
              {isOwner && (
                <Button size="sm" variant="outline" className="shrink-0 mt-1" onClick={() => setIsEditOpen(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>
              )}
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

            {printStatementUrl && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => { window.location.href = printStatementUrl }}
              >
                <Printer className="h-3.5 w-3.5 mr-1.5" />
                Print Statement
              </Button>
            )}
          </div>

          {/* ── Right column: order history ── */}
          <div>

            {/* Table header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Order History
              </h2>
              <div className="flex items-center gap-2">
                {/* Bulk payment button — only when there are unpaid/partial sales */}
                {hasBulkable && !selectionMode && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectionMode(true)}
                  >
                    <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                    Bulk Payment
                  </Button>
                )}
                {/* Select all — shown in selection mode */}
                {selectionMode && (
                  <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                    />
                    Select all
                  </label>
                )}
                <TableOptionsButton
                  hiddenKeys={hiddenKeys}
                  onToggleColumn={toggleColumn}
                  exportColumns={ORDER_HISTORY_EXPORT_COLUMNS}
                  exportRows={orderHistoryExportRows}
                  exportFilename={`hydra-orders-${customer?.name ?? 'customer'}`}
                  exportTitle={customer ? `Orders — ${customer.name}` : 'Order History'}
                />
              </div>
            </div>

            <DataTable
              tableId="customer-order-history"
              columns={activeColumns}
              data={sortedSales}
              rowKey={(sale) => sale.id}
              hiddenKeys={hiddenKeys}
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

            {/* ── Bulk payment action bar — inline below table ── */}
            {selectionMode && (
              <div className="mt-4 rounded-xl border border-border bg-card shadow-sm p-4 space-y-3">

                {/* Header label */}
                <p className="text-sm font-semibold text-foreground">
                  {selectedIds.size > 0
                    ? `${selectedIds.size} ${selectedIds.size === 1 ? 'order' : 'orders'} selected`
                    : 'Select orders above'}
                </p>

                {selectedIds.size > 0 && (
                  <>
                    {/* Total */}
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Total</span>
                      <span className="text-xl font-bold text-primary">{formatCurrency(bulkTotal)}</span>
                    </div>

                    {/* Payment amount input */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-muted-foreground shrink-0">Payment</span>
                      <div className="relative flex-1 max-w-[180px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₱</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          className="pl-8 h-11 text-2xl font-bold text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={bulkAmountDisplayValue}
                          onChange={handleBulkAmountChange}
                        />
                      </div>
                    </div>

                    {/* Payment mode pills */}
                    <div className="flex gap-1.5">
                      {BULK_PAY_MODES.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setBulkPayMode(m.value)}
                          className={cn(pillBase, bulkPayMode === m.value ? pillActive : pillInactive)}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {/* Balance due */}
                    {bulkBalance > 0 && (
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm text-muted-foreground">Balance due</span>
                        <span className="text-base font-semibold text-destructive">{formatCurrency(bulkBalance)}</span>
                      </div>
                    )}

                    {/* Overpayment warning */}
                    {bulkIsOverpayment && (
                      <p className="text-xs text-amber-600">Overpayment — excess amount will not be applied</p>
                    )}
                  </>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={isBulkPaying}
                    onClick={exitSelectionMode}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={isBulkPaying || selectedIds.size === 0 || bulkAmountInput <= 0}
                    onClick={() => void handleBulkPayment()}
                  >
                    {isBulkPaying ? 'Processing…' : 'Confirm Payment'}
                  </Button>
                </div>

              </div>
            )}
          </div>

        </div>
      )}

      {/* ── Single payment modal ── */}
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
          onAdd={async () => { /* edit mode only */ }}
          onUpdate={updateCustomer}
        />
      )}

    </div>
  )
}

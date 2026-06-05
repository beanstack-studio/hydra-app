import { useState } from 'react'
import { AlertCircle, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { RecordPaymentModal } from './RecordPaymentModal'
import { SaleDetailModal } from './SaleDetailModal'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { useUnpaidSales } from '../hooks/useUnpaidSales'
import type { Sale, PaymentMode } from '../types'

type UnpaidSortKey = 'customer' | 'date' | 'balance'
type SortDir = 'asc' | 'desc'

export function UnpaidSalesList() {
  const { data, isLoading, error, recordPayment } = useUnpaidSales()
  const [payingSale, setPayingSale] = useState<Sale | null>(null)
  const [viewingSale, setViewingSale] = useState<Sale | null>(null)
  const [sortKey, setSortKey] = useState<UnpaidSortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleRecord = async (
    saleId: string,
    amount: number,
    paymentMode: PaymentMode,
    paidAt: string,
    remarks: string,
  ) => {
    await recordPayment({ saleId, amount, paymentMode, paidAt, remarks })
  }

  const handleSort = (key: UnpaidSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = [...data].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'customer') cmp = a.customer_name.localeCompare(b.customer_name)
    if (sortKey === 'date') cmp = a.sale_date.localeCompare(b.sale_date)
    if (sortKey === 'balance') cmp = a.balance_due - b.balance_due
    return sortDir === 'asc' ? cmp : -cmp
  })

  const sortIcon = (key: UnpaidSortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3 w-3 opacity-40" />
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3" />
      : <ChevronDown className="h-3 w-3" />
  }

  const headerBtnCls = (key: UnpaidSortKey) => cn(
    'inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors duration-150 select-none',
    sortKey === key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
  )

  if (isLoading) return <LoadingSkeleton rows={3} />
  if (error) return <p className="text-sm text-destructive">{error}</p>

  return (
    <>
      {data.length === 0 ? (
        <EmptyState
          icon={<AlertCircle className="h-8 w-8" />}
          title="No unpaid sales"
          description="All sales are settled."
        />
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <button type="button" className={headerBtnCls('customer')} onClick={() => handleSort('customer')}>
              Customer {sortIcon('customer')}
            </button>
            <div className="flex items-center gap-4">
              <button type="button" className={headerBtnCls('date')} onClick={() => handleSort('date')}>
                Date {sortIcon('date')}
              </button>
              <button type="button" className={headerBtnCls('balance')} onClick={() => handleSort('balance')}>
                Balance {sortIcon('balance')}
              </button>
            </div>
          </div>
          {sorted.map((sale) => (
            <div
              key={sale.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0 mr-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground truncate">{sale.customer_name}</p>
                  <Badge variant={sale.status === 'partial' ? 'outline' : 'destructive'}>
                    {sale.status === 'partial' ? 'Partial' : 'Unpaid'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {sale.product_name} ×{sale.qty} · {formatDate(sale.sale_date)}
                </p>
                <p className="text-xs font-semibold text-destructive mt-0.5">
                  Balance: {formatCurrency(sale.balance_due)}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs px-2.5"
                  onClick={() => setViewingSale(sale)}
                >
                  View
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => setPayingSale(sale)}
                >
                  Pay
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SaleDetailModal
        sale={viewingSale}
        isOpen={!!viewingSale}
        onClose={() => setViewingSale(null)}
      />

      <RecordPaymentModal
        sale={payingSale}
        isOpen={!!payingSale}
        onClose={() => setPayingSale(null)}
        onRecord={handleRecord}
      />
    </>
  )
}

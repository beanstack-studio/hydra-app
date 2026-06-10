import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { SearchInput } from '@/components/shared/SearchInput'
import type { ExportColumnDef } from '@/components/shared/ExportModal'
import { SaleModal } from '@/features/sales/components/SaleModal'
import { SaleDetailModal } from '@/features/sales/components/SaleDetailModal'
import { SaleTable } from '@/features/sales/components/SaleTable'
import { RecordPaymentModal } from '@/features/sales/components/RecordPaymentModal'
import { RescheduleModal } from '@/features/sales/components/RescheduleModal'
import { useSales } from '@/features/sales/hooks/useSales'
import { useCustomers } from '@/features/customers/hooks/useCustomers'
import { useSettings } from '@/features/settings/hooks/useSettings'
import { useToast } from '@/hooks/use-toast'
import { formatDate, formatCurrency, formatExportAmount } from '@/lib/utils'
import type { FilterGroup } from '@/components/shared/FilterButton'
import { TableOptionsButton } from '@/components/shared/TableOptionsButton'
import { useAuthStore } from '@/stores/authStore'
import { useTablePrefs } from '@/hooks/useTablePrefs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Sale, SaleInsert } from '@/features/sales/types'

const SALE_FILTER_GROUPS: FilterGroup[] = [
  {
    key: 'status',
    label: 'Status',
    options: [
      { value: 'unpaid',  label: 'Unpaid'  },
      { value: 'partial', label: 'Partial' },
      { value: 'paid',    label: 'Paid'    },
    ],
  },
  {
    key: 'order_type',
    label: 'Order Type',
    options: [
      { value: 'walk-in',  label: 'Walk-in'  },
      { value: 'delivery', label: 'Delivery' },
      { value: 'pickup',   label: 'Pickup'   },
    ],
  },
]

const SALES_EXPORT_COLUMNS: ExportColumnDef[] = [
  { key: 'date',        label: 'Date' },                              // visible
  { key: 'customer',    label: 'Customer' },                         // visible
  { key: 'order_type',  label: 'Order Type' },                      // visible
  { key: 'product',     label: 'Product',     defaultChecked: false },
  { key: 'total',       label: 'Total' },                           // visible
  { key: 'payment',     label: 'Payment' },                         // visible
  { key: 'status',      label: 'Status' },                          // visible
  { key: 'balance_due', label: 'Balance Due' },                     // visible
  { key: 'remarks',     label: 'Remarks',     defaultChecked: false },
]

export default function SalesPage() {
  const { toast } = useToast()
  const role = useAuthStore((s) => s.role)
  const { hiddenKeys, toggleColumn, columnWidths, onColumnResize } = useTablePrefs('sales', ['product', 'remarks'])
  const [isSaleModalOpen,   setIsSaleModalOpen]   = useState(false)
  const [selectedSale,      setSelectedSale]      = useState<Sale | null>(null)
  const [payingSale,        setPayingSale]        = useState<Sale | null>(null)
  const [reschedulingSale,  setReschedulingSale]  = useState<Sale | null>(null)
  const [deletingSale,      setDeletingSale]      = useState<Sale | null>(null)
  const [isDeleting,        setIsDeleting]        = useState(false)
  const [search,            setSearch]            = useState('')
  const [filters,           setFilters]           = useState<Record<string, string>>({})

  const { data: sales, isLoading: salesLoading, error: salesError, addSale, deleteSale, recordPayment, rescheduleOrder, confirmFulfillment } = useSales()
  const { data: customers } = useCustomers()
  const { data: settings, isLoading: settingsLoading } = useSettings()

  // Keep selectedSale in sync when useSales re-fetches (e.g. after address or reschedule update)
  useEffect(() => {
    if (!selectedSale) return
    const updated = sales.find((s) => s.id === selectedSale.id)
    if (updated && updated !== selectedSale) setSelectedSale(updated)
  }, [sales, selectedSale])

  const handleAddSale = async (input: SaleInsert) => addSale(input)

  const isLoading = salesLoading || settingsLoading

  const filteredSales = sales
    .filter((s) => {
      if (filters.status     && filters.status     !== s.status)     return false
      if (filters.order_type && filters.order_type !== s.order_type) return false
      return true
    })
    .filter((s) =>
      search.length >= 3
        ? s.customer_name.toLowerCase().includes(search.toLowerCase()) ||
          s.product_name.toLowerCase().includes(search.toLowerCase()) ||
          s.order_type.toLowerCase().includes(search.toLowerCase())
        : true
    )

  const exportRows = filteredSales.map((s) => ({
    date:        formatDate(s.sale_date),
    customer:    s.customer_name,
    order_type:  s.order_type,
    product: (() => {
      const lines = s.items && s.items.length > 0
        ? s.items.map((i) => `${i.product_name} ×${i.qty}`)
        : [`${s.product_name} ×${s.qty}`]
      if (s.container_enabled && s.container_qty > 0) lines.push(`Container ×${s.container_qty}`)
      return lines.join('; ')
    })(),
    total:       formatExportAmount(s.total_amount),
    payment:     s.payment_mode,
    status:      s.status,
    balance_due: s.balance_due > 0 ? formatExportAmount(s.balance_due) : '',
    remarks:     s.remarks ?? '',
  }))

  const handleRecord = async (
    saleId: string, amount: number,
    paymentMode: import('@/features/sales/types').PaymentMode,
    paidAt: string, remarks: string
  ) => {
    await recordPayment(saleId, amount, paymentMode, paidAt, remarks)
    toast({ title: 'Payment recorded' })
    setPayingSale(null)
  }

  const handleDeleteSale = async () => {
    if (!deletingSale) return
    setIsDeleting(true)
    try {
      await deleteSale(deletingSale.id)
      toast({ title: 'Sale deleted' })
      setDeletingSale(null)
    } catch (e) {
      toast({ title: 'Failed to delete', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleRescheduleClick = () => {
    const sale = selectedSale
    setSelectedSale(null)
    if (sale) setReschedulingSale(sale)
  }

  const handleConfirmFulfillment = async () => {
    if (!selectedSale) return
    const label = selectedSale.order_type === 'delivery' ? 'delivered' : 'picked up'
    try {
      await confirmFulfillment(selectedSale.id)
      toast({ title: `Marked as ${label}` })
    } catch (e) {
      toast({ title: 'Failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    }
  }

  return (
    <div>
      <PageHeader title="Sales" />

      {salesError && (
        <p className="mb-4 text-sm text-destructive">{salesError}</p>
      )}

      <div className="flex items-center gap-3 mb-4">
        <SearchInput
          onSearch={setSearch}
          placeholder="Search customer, product, order type…"
          className="flex-1"
        />
        <TableOptionsButton
          filterGroups={SALE_FILTER_GROUPS}
          filterValue={filters}
          onFilterChange={(key, val) => setFilters((prev) => ({ ...prev, [key]: val }))}
          onFilterReset={() => setFilters({})}
          hiddenKeys={hiddenKeys}
          onToggleColumn={toggleColumn}
          exportColumns={SALES_EXPORT_COLUMNS}
          exportRows={exportRows}
          exportFilename="hydra-sales"
          exportTitle="Sales"
        />
        <Button size="sm" onClick={() => setIsSaleModalOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Record Sale
        </Button>
      </div>

      {/* Sales list */}
      {isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : (
        <SaleTable
          sales={filteredSales}
          onSelect={setSelectedSale}
          onPay={(sale) => {
            setSelectedSale(null)
            setPayingSale(sale)
          }}
          onDelete={role !== 'staff' ? setDeletingSale : undefined}
          hiddenKeys={hiddenKeys}
          columnWidths={columnWidths}
          onColumnResize={onColumnResize}
        />
      )}

      {/* Sale detail modal */}
      <SaleDetailModal
        sale={selectedSale}
        isOpen={!!selectedSale}
        onClose={() => setSelectedSale(null)}
        onReschedule={handleRescheduleClick}
        onConfirmFulfillment={handleConfirmFulfillment}
        customerPhone={customers.find((c) => c.id === selectedSale?.customer_id)?.phone ?? null}
        customerAddress={customers.find((c) => c.id === selectedSale?.customer_id)?.address ?? null}
      />

      {/* Reschedule modal */}
      <RescheduleModal
        sale={reschedulingSale}
        isOpen={!!reschedulingSale}
        onClose={() => setReschedulingSale(null)}
        onReschedule={rescheduleOrder}
        stationSettings={settings?.stationSettings ?? null}
      />

      {/* Delete confirm dialog */}
      <Dialog open={!!deletingSale} onOpenChange={(open) => { if (!open) setDeletingSale(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Sale</DialogTitle>
            <DialogDescription>
              Delete {deletingSale?.customer_name}&apos;s sale of {formatCurrency(deletingSale?.total_amount ?? 0)}?
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingSale(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSale} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record payment modal */}
      <RecordPaymentModal
        sale={payingSale}
        isOpen={!!payingSale}
        onClose={() => setPayingSale(null)}
        onRecord={handleRecord}
      />


      {/* Record sale modal */}
      <SaleModal
        isOpen={isSaleModalOpen}
        onClose={() => setIsSaleModalOpen(false)}
        products={settings?.products ?? []}
        deliveryZones={settings?.deliveryZones ?? []}
        stationSettings={settings?.stationSettings ?? null}
        onSubmit={handleAddSale}
      />
    </div>
  )
}

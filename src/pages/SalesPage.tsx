import { useState } from 'react'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { SearchInput } from '@/components/shared/SearchInput'
import { ExportModal, type ExportColumnDef } from '@/components/shared/ExportModal'
import { SaleModal } from '@/features/sales/components/SaleModal'
import { SaleDetailModal } from '@/features/sales/components/SaleDetailModal'
import { SaleTable } from '@/features/sales/components/SaleTable'
import { RecordPaymentModal } from '@/features/sales/components/RecordPaymentModal'
import { RescheduleModal } from '@/features/sales/components/RescheduleModal'
import { useSales } from '@/features/sales/hooks/useSales'
import { useSettings } from '@/features/settings/hooks/useSettings'
import { useToast } from '@/hooks/use-toast'
import { formatDate, formatExportAmount } from '@/lib/utils'
import type { Sale, SaleInsert } from '@/features/sales/types'

const SALES_EXPORT_COLUMNS: ExportColumnDef[] = [
  { key: 'date',            label: 'Date' },           // visible
  { key: 'customer',        label: 'Customer' },       // visible
  { key: 'order_type',      label: 'Order Type' },     // visible
  { key: 'product',         label: 'Product',         defaultChecked: false },
  { key: 'qty',             label: 'Qty',             defaultChecked: false },
  { key: 'price_per_piece', label: 'Price/pc',        defaultChecked: false },
  { key: 'total',           label: 'Total' },          // visible
  { key: 'payment',         label: 'Payment' },        // visible
  { key: 'status',          label: 'Status' },         // visible
  { key: 'balance_due',     label: 'Balance Due',     defaultChecked: false },
  { key: 'remarks',         label: 'Remarks',         defaultChecked: false },
]

export default function SalesPage() {
  const { toast } = useToast()
  const [isSaleModalOpen,   setIsSaleModalOpen]   = useState(false)
  const [selectedSale,      setSelectedSale]      = useState<Sale | null>(null)
  const [payingSale,        setPayingSale]        = useState<Sale | null>(null)
  const [reschedulingSale,  setReschedulingSale]  = useState<Sale | null>(null)
  const [search,            setSearch]            = useState('')
  const [isExportOpen,      setIsExportOpen]      = useState(false)

  const { data: sales, isLoading: salesLoading, error: salesError, addSale, recordPayment, rescheduleOrder, confirmFulfillment } = useSales()
  const { data: settings, isLoading: settingsLoading } = useSettings()

  const handleAddSale = async (input: SaleInsert) => addSale(input)

  const isLoading = salesLoading || settingsLoading

  const filteredSales = search.length >= 3
    ? sales.filter((s) =>
        s.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        s.product_name.toLowerCase().includes(search.toLowerCase()) ||
        s.order_type.toLowerCase().includes(search.toLowerCase())
      )
    : sales

  const exportRows = sales.map((s) => ({
    date:            formatDate(s.sale_date),
    customer:        s.customer_name,
    order_type:      s.order_type,
    product:         s.product_name,
    qty:             s.qty,
    price_per_piece: formatExportAmount(s.price_per_piece),
    total:           formatExportAmount(s.total_amount),
    payment:         s.payment_mode,
    status:          s.status,
    balance_due:     s.balance_due > 0 ? formatExportAmount(s.balance_due) : '',
    remarks:         s.remarks ?? '',
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
          onExport={() => setIsExportOpen(true)}
          onPay={(sale) => {
            setSelectedSale(null)
            setPayingSale(sale)
          }}
        />
      )}

      {/* Sale detail modal */}
      <SaleDetailModal
        sale={selectedSale}
        isOpen={!!selectedSale}
        onClose={() => setSelectedSale(null)}
        onReschedule={handleRescheduleClick}
        onConfirmFulfillment={handleConfirmFulfillment}
      />

      {/* Reschedule modal */}
      <RescheduleModal
        sale={reschedulingSale}
        isOpen={!!reschedulingSale}
        onClose={() => setReschedulingSale(null)}
        onReschedule={rescheduleOrder}
      />

      {/* Record payment modal */}
      <RecordPaymentModal
        sale={payingSale}
        isOpen={!!payingSale}
        onClose={() => setPayingSale(null)}
        onRecord={handleRecord}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        title="Sales"
        filename="hydra-sales"
        columns={SALES_EXPORT_COLUMNS}
        rows={exportRows}
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

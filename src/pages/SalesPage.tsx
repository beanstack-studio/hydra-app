import { useState } from 'react'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { SaleModal } from '@/features/sales/components/SaleModal'
import { SaleDetailModal } from '@/features/sales/components/SaleDetailModal'
import { SaleTable } from '@/features/sales/components/SaleTable'
import { RecordPaymentModal } from '@/features/sales/components/RecordPaymentModal'
import { RescheduleModal } from '@/features/sales/components/RescheduleModal'
import { useSales } from '@/features/sales/hooks/useSales'
import { useSettings } from '@/features/settings/hooks/useSettings'
import { useToast } from '@/hooks/use-toast'
import type { Sale, SaleInsert } from '@/features/sales/types'

export default function SalesPage() {
  const { toast } = useToast()
  const [isSaleModalOpen,   setIsSaleModalOpen]   = useState(false)
  const [selectedSale,      setSelectedSale]      = useState<Sale | null>(null)
  const [payingSale,        setPayingSale]        = useState<Sale | null>(null)
  const [reschedulingSale,  setReschedulingSale]  = useState<Sale | null>(null)

  const { data: sales, isLoading: salesLoading, error: salesError, addSale, recordPayment, rescheduleOrder, confirmFulfillment } = useSales()
  const { data: settings, isLoading: settingsLoading } = useSettings()

  const handleAddSale = async (input: SaleInsert) => addSale(input)

  const isLoading = salesLoading || settingsLoading

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
      <PageHeader title="Sales">
        <Button onClick={() => setIsSaleModalOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Record Sale
        </Button>
      </PageHeader>

      {salesError && (
        <p className="mb-4 text-sm text-destructive">{salesError}</p>
      )}

      {/* Sales list */}
      {isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : (
        <SaleTable
          sales={sales}
          onSelect={setSelectedSale}
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

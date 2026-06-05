import { useState } from 'react'
import { Download } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { StockTable } from '@/features/inventory/components/StockTable'
import { StockAdjustModal } from '@/features/inventory/components/StockAdjustModal'
import { useInventory } from '@/features/inventory/hooks/useInventory'
import { useToast } from '@/hooks/use-toast'
import { formatInTimeZone } from 'date-fns-tz'
import { PH_TZ } from '@/lib/utils'
import type { InventoryItem } from '@/features/inventory/types'

const STATUS_LABELS: Record<string, string> = {
  in_stock: 'In Stock',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
}

function exportToCsv(items: InventoryItem[]) {
  const dateStr = formatInTimeZone(new Date(), PH_TZ, 'yyyy-MM-dd')
  const headers = ['Product', 'Available Qty', 'Low Stock Threshold', 'Status']
  const rows = items.map((item) => [
    item.product_name,
    item.available_qty,
    item.threshold,
    STATUS_LABELS[item.status] ?? item.status,
  ])
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `inventory-${dateStr}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function InventoryPage() {
  const { toast } = useToast()
  const { data, isLoading, error, adjustQty } = useInventory()
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null)

  const handleQuickAdjust = async (item: InventoryItem, delta: number) => {
    const newQty = Math.max(0, item.available_qty + delta)
    try {
      await adjustQty(item.id, newQty, item.threshold)
    } catch (e) {
      toast({ title: 'Update failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    }
  }

  const handleAdjust = async (id: string, qty: number, threshold: number, expenseAmount?: number) => {
    await adjustQty(id, qty, threshold, expenseAmount)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <PageHeader title="Inventory" />
        <Button
          size="sm"
          variant="outline"
          disabled={isLoading || data.length === 0}
          onClick={() => exportToCsv(data)}
        >
          <Download className="h-4 w-4 mr-1.5" />
          Export CSV
        </Button>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <StockTable
        items={data}
        isLoading={isLoading}
        onAdjustClick={setAdjustingItem}
        onQuickAdjust={handleQuickAdjust}
      />

      <StockAdjustModal
        item={adjustingItem}
        isOpen={!!adjustingItem}
        onClose={() => setAdjustingItem(null)}
        onAdjust={handleAdjust}
      />
    </div>
  )
}

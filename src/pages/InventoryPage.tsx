import { useState } from 'react'
import { Download, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { StockTable } from '@/features/inventory/components/StockTable'
import { StockAdjustModal } from '@/features/inventory/components/StockAdjustModal'
import { SupplyTable } from '@/features/supplies/components/SupplyTable'
import { SupplyModal } from '@/features/supplies/components/SupplyModal'
import { useInventory } from '@/features/inventory/hooks/useInventory'
import { useSupplies } from '@/features/supplies/hooks/useSupplies'
import { useSettings } from '@/features/settings/hooks/useSettings'
import { useExpenses } from '@/features/expenses/hooks/useExpenses'
import { useToast } from '@/hooks/use-toast'
import { formatInTimeZone } from 'date-fns-tz'
import { PH_TZ } from '@/lib/utils'
import type { InventoryItem } from '@/features/inventory/types'
import type { Supply, SupplyInput } from '@/features/supplies/types'

export default function InventoryPage() {
  const { toast } = useToast()

  // Inventory (sellable products)
  const { data: stockItems, isLoading: stockLoading, error: stockError, adjustQty } = useInventory()
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null)

  // Supplies
  const { data: supplies, isLoading: suppliesLoading, error: suppliesError, addSupply, updateSupply, deleteSupply, adjustQty: adjustSupplyQty, logAsExpense } = useSupplies()
  const [supplyModalOpen, setSupplyModalOpen] = useState(false)
  const [editingSupply, setEditingSupply] = useState<Supply | null>(null)

  // Products list for linked product dropdown
  const { data: settings } = useSettings()
  const products = settings?.products ?? []

  // Expenses hook for "Log as Expense" — opens ExpenseModal pre-filled
  const { addExpense } = useExpenses()

  const productNames: Record<string, string> = Object.fromEntries(
    products.map((p) => [p.id, p.name])
  )

  // Stock handlers
  const handleQuickAdjust = async (item: InventoryItem, delta: number) => {
    try {
      await adjustQty(item.id, Math.max(0, item.available_qty + delta), item.threshold)
    } catch (e) {
      toast({ title: 'Update failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    }
  }

  const handleAdjust = async (id: string, qty: number, threshold: number, expenseAmount?: number) => {
    await adjustQty(id, qty, threshold, expenseAmount)
  }

  // Supply handlers
  const handleAddSupply = async (input: SupplyInput) => {
    await addSupply(input)
  }

  const handleUpdateSupply = async (id: string, input: SupplyInput) => {
    await updateSupply(id, input)
  }

  const handleDeleteSupply = async (item: Supply) => {
    if (!confirm(`Delete "${item.name}"?`)) return
    try {
      await deleteSupply(item.id)
      toast({ title: 'Item deleted' })
    } catch (e) {
      toast({ title: 'Delete failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    }
  }

  const handleQuickAdjustSupply = async (item: Supply, delta: number) => {
    try {
      await adjustSupplyQty(item.id, item.qty + delta)
    } catch (e) {
      toast({ title: 'Update failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    }
  }

  const handleLogAsExpense = async (item: Supply) => {
    if (item.price_per_unit == null) {
      toast({ title: 'No price set', description: 'Add a price per unit to log this as an expense.', variant: 'destructive' })
      return
    }
    try {
      await logAsExpense(item, item.qty)
      toast({ title: 'Logged as expense', description: `${item.name} added to General expenses.` })
    } catch (e) {
      toast({ title: 'Failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    }
  }

  // CSV export for stock
  const exportStockCsv = () => {
    const dateStr = formatInTimeZone(new Date(), PH_TZ, 'yyyy-MM-dd')
    const headers = ['Product', 'Available Qty', 'Threshold', 'Status']
    const rows = stockItems.map((i) => [i.product_name, i.available_qty, i.threshold, i.status])
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `stock-${dateStr}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-8">
      {/* ── Product Stock ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <PageHeader title="Inventory" />
          <Button size="sm" variant="outline" disabled={stockLoading || stockItems.length === 0} onClick={exportStockCsv}>
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
        </div>

        {stockError && <p className="mb-4 text-sm text-destructive">{stockError}</p>}

        <div className="mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Product Stock</p>
          <p className="text-xs text-muted-foreground mt-0.5">Water and ice products — auto-deducted when a sale is recorded.</p>
        </div>

        <StockTable
          items={stockItems}
          isLoading={stockLoading}
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

      {/* ── Supplies & Assets ──────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Supplies & Assets</p>
            <p className="text-xs text-muted-foreground mt-0.5">Operational items, containers, uniforms, and consumables.</p>
          </div>
          <Button size="sm" onClick={() => { setEditingSupply(null); setSupplyModalOpen(true) }}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Item
          </Button>
        </div>

        {suppliesError && <p className="mb-4 text-sm text-destructive">{suppliesError}</p>}

        <SupplyTable
          items={supplies}
          isLoading={suppliesLoading}
          productNames={productNames}
          onEditClick={(item) => { setEditingSupply(item); setSupplyModalOpen(true) }}
          onDeleteClick={handleDeleteSupply}
          onQuickAdjust={handleQuickAdjustSupply}
          onLogAsExpense={handleLogAsExpense}
        />
      </div>

      <SupplyModal
        isOpen={supplyModalOpen}
        onClose={() => { setSupplyModalOpen(false); setEditingSupply(null) }}
        supply={editingSupply}
        products={products}
        onAdd={handleAddSupply}
        onUpdate={handleUpdateSupply}
      />
    </div>
  )
}

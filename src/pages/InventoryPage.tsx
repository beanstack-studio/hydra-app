import { useState } from 'react'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/shared/SearchInput'
import { SupplyTable } from '@/features/supplies/components/SupplyTable'
import { SupplyModal } from '@/features/supplies/components/SupplyModal'
import { useSupplies } from '@/features/supplies/hooks/useSupplies'
import { useSettings } from '@/features/settings/hooks/useSettings'
import { useToast } from '@/hooks/use-toast'
import { formatDate, formatCurrency, downloadCSV } from '@/lib/utils'
import { computeStatus } from '@/features/supplies/hooks/useSupplies'
import type { Supply, SupplyInput } from '@/features/supplies/types'

export default function InventoryPage() {
  const { toast } = useToast()

  const { data: supplies, isLoading, error, addSupply, updateSupply, deleteSupply, adjustQty } = useSupplies()
  const { data: settings } = useSettings()
  const products = settings?.products ?? []

  const [supplyModalOpen, setSupplyModalOpen] = useState(false)
  const [editingSupply,   setEditingSupply]   = useState<Supply | null>(null)
  const [search,          setSearch]          = useState('')

  const productNames: Record<string, string> = Object.fromEntries(
    products.map((p) => [p.id, p.name])
  )

  const filteredSupplies = search.length >= 3
    ? supplies.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.store ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : supplies

  const handleExport = () => {
    const statusLabel = { in_stock: 'In Stock', low_stock: 'Low Stock', out_of_stock: 'Out of Stock' }
    downloadCSV(
      `hydra-inventory-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Item', 'Status', 'Qty', 'Price/Unit', 'Last Purchase', 'Store'],
      supplies.map((s) => [
        s.name,
        statusLabel[computeStatus(s.qty, s.threshold)],
        s.qty,
        s.price_per_unit != null ? formatCurrency(s.price_per_unit) : '',
        s.last_purchased_at ? formatDate(s.last_purchased_at) : '',
        s.store ?? '',
      ])
    )
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

  const handleQuickAdjust = async (item: Supply, delta: number) => {
    try {
      await adjustQty(item.id, item.qty + delta)
    } catch (e) {
      toast({ title: 'Update failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    }
  }

  return (
    <div>
      <PageHeader title="Inventory" />

      <div className="flex items-center gap-3 mb-4">
        <SearchInput
          onSearch={setSearch}
          placeholder="Search items or store…"
          className="flex-1"
        />
        <Button size="sm" onClick={() => { setEditingSupply(null); setSupplyModalOpen(true) }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Item
        </Button>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <SupplyTable
        items={filteredSupplies}
        isLoading={isLoading}
        productNames={productNames}
        onEditClick={(item) => { setEditingSupply(item); setSupplyModalOpen(true) }}
        onDeleteClick={handleDeleteSupply}
        onQuickAdjust={handleQuickAdjust}
        onExport={handleExport}
      />

      <SupplyModal
        isOpen={supplyModalOpen}
        onClose={() => { setSupplyModalOpen(false); setEditingSupply(null) }}
        supply={editingSupply}
        products={products}
        onAdd={async (input: SupplyInput) => { await addSupply(input) }}
        onUpdate={async (id, input) => { await updateSupply(id, input) }}
      />
    </div>
  )
}

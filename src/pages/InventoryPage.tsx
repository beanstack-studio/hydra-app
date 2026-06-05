import { useState } from 'react'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { SupplyTable } from '@/features/supplies/components/SupplyTable'
import { SupplyModal } from '@/features/supplies/components/SupplyModal'
import { useSupplies } from '@/features/supplies/hooks/useSupplies'
import { useSettings } from '@/features/settings/hooks/useSettings'
import { useToast } from '@/hooks/use-toast'
import type { Supply, SupplyInput } from '@/features/supplies/types'

export default function InventoryPage() {
  const { toast } = useToast()

  const { data: supplies, isLoading, error, addSupply, updateSupply, deleteSupply, adjustQty } = useSupplies()
  const { data: settings } = useSettings()
  const products = settings?.products ?? []

  const [supplyModalOpen, setSupplyModalOpen] = useState(false)
  const [editingSupply,   setEditingSupply]   = useState<Supply | null>(null)

  const productNames: Record<string, string> = Object.fromEntries(
    products.map((p) => [p.id, p.name])
  )

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
      <div className="flex items-center justify-between mb-6">
        <PageHeader title="Inventory" />
        <Button size="sm" onClick={() => { setEditingSupply(null); setSupplyModalOpen(true) }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Item
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Add items here to track them. Log purchases via <span className="font-medium text-foreground">Expenses → Supplies</span> — qty and price update automatically.
      </p>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <SupplyTable
        items={supplies}
        isLoading={isLoading}
        productNames={productNames}
        onEditClick={(item) => { setEditingSupply(item); setSupplyModalOpen(true) }}
        onDeleteClick={handleDeleteSupply}
        onQuickAdjust={handleQuickAdjust}
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

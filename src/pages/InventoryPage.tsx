import { useState } from 'react'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { SupplyTable } from '@/features/supplies/components/SupplyTable'
import { SupplyModal } from '@/features/supplies/components/SupplyModal'
import { LogExpenseModal } from '@/features/supplies/components/LogExpenseModal'
import { useSupplies } from '@/features/supplies/hooks/useSupplies'
import { useSettings } from '@/features/settings/hooks/useSettings'
import { useToast } from '@/hooks/use-toast'
import { formatInTimeZone } from 'date-fns-tz'
import { PH_TZ } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Supply, SupplyInput } from '@/features/supplies/types'

export default function InventoryPage() {
  const { toast } = useToast()
  const stationId = useAuthStore((s) => s.stationId)

  const { data: supplies, isLoading, error, addSupply, updateSupply, deleteSupply, adjustQty } = useSupplies()
  const { data: settings } = useSettings()
  const products = settings?.products ?? []

  const [supplyModalOpen, setSupplyModalOpen]   = useState(false)
  const [editingSupply,   setEditingSupply]      = useState<Supply | null>(null)
  const [logExpenseItem,  setLogExpenseItem]     = useState<Supply | null>(null)

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

  const handleLogExpense = async (supply: Supply, qty: number, pricePerUnit: number, date: string) => {
    if (!stationId) return
    const amount = qty * pricePerUnit
    const todayPH = formatInTimeZone(new Date(), PH_TZ, 'yyyy-MM-dd')
    const { error: e } = await supabase.from('expenses').insert({
      station_id:     stationId,
      category:       'supplies',
      item:           supply.name,
      price:          amount,
      amount,
      frequency:      'one_off',
      expense_date:   date || todayPH,
      payment_method: null,
      remarks:        `${qty} × ${supply.name}${supply.store ? ` from ${supply.store}` : ''}`,
    })
    if (e) throw new Error(e.message)
    toast({ title: 'Expense logged', description: `${supply.name} added to General expenses.` })
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

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <SupplyTable
        items={supplies}
        isLoading={isLoading}
        onEditClick={(item) => { setEditingSupply(item); setSupplyModalOpen(true) }}
        onDeleteClick={handleDeleteSupply}
        onQuickAdjust={handleQuickAdjust}
        onLogAsExpense={(item) => setLogExpenseItem(item)}
      />

      <SupplyModal
        isOpen={supplyModalOpen}
        onClose={() => { setSupplyModalOpen(false); setEditingSupply(null) }}
        supply={editingSupply}
        products={products}
        onAdd={async (input: SupplyInput) => { await addSupply(input) }}
        onUpdate={async (id, input) => { await updateSupply(id, input) }}
      />

      <LogExpenseModal
        isOpen={!!logExpenseItem}
        onClose={() => setLogExpenseItem(null)}
        supply={logExpenseItem}
        onSubmit={handleLogExpense}
      />
    </div>
  )
}

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { UpgradeWall } from '@/components/shared/UpgradeWall'
import { usePlan } from '@/hooks/usePlan'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/shared/SearchInput'
import { SupplyTable } from '@/features/supplies/components/SupplyTable'
import { SupplyModal } from '@/features/supplies/components/SupplyModal'
import { useSupplies } from '@/features/supplies/hooks/useSupplies'
import { useSettings } from '@/features/settings/hooks/useSettings'
import { useToast } from '@/hooks/use-toast'
import { formatDate, formatExportAmount } from '@/lib/utils'
import type { ExportColumnDef } from '@/components/shared/ExportModal'
import type { FilterGroup } from '@/components/shared/FilterButton'
import { TableOptionsButton } from '@/components/shared/TableOptionsButton'
import { useTablePrefs } from '@/hooks/useTablePrefs'

const INVENTORY_EXPORT_COLUMNS: ExportColumnDef[] = [
  { key: 'item',            label: 'Item' },                                     // visible
  { key: 'supplier',        label: 'Supplier' },                                 // visible
  { key: 'linked_product',  label: 'Used For Product' },                        // visible
  { key: 'last_purchase',   label: 'Last Purchase' },                            // visible
  { key: 'status',          label: 'Status' },                                   // visible
  { key: 'qty',             label: 'Qty' },                                      // visible
  { key: 'threshold',       label: 'Low Stock Threshold', defaultChecked: false },
  { key: 'price_per_unit',  label: 'Price/Unit',          defaultChecked: false },
]
import { computeStatus } from '@/features/supplies/hooks/useSupplies'
import type { Supply, SupplyInput } from '@/features/supplies/types'

export default function InventoryPage() {
  const plan    = usePlan()
  const role    = useAuthStore((s) => s.role)
  const { hiddenKeys, toggleColumn, columnWidths, onColumnResize, columnOrder, onColumnReorder, filterValues, setFilterValues } = useTablePrefs('inventory', ['threshold', 'price_per_unit'])
  const isOwner = role === 'owner' || role === 'super_admin'
  const { toast } = useToast()

  const { data: supplies, isLoading, error, addSupply, updateSupply, deleteSupply, adjustQty } = useSupplies()
  const { data: settings } = useSettings()
  const [supplyModalOpen, setSupplyModalOpen] = useState(false)
  const [editingSupply,   setEditingSupply]   = useState<Supply | null>(null)
  const [search,          setSearch]          = useState('')

  const products = settings?.products ?? []

  if (plan === 'free') return <UpgradeWall title="Inventory" feature="Inventory" />

  const productNames: Record<string, string> = Object.fromEntries(
    products.map((p) => [p.id, p.name])
  )

  const uniqueStores = [...new Set(supplies.map((s) => s.store).filter(Boolean))] as string[]

  const inventoryFilterGroups: FilterGroup[] = [
    {
      key: 'status',
      label: 'Stock Status',
      options: [
        { value: 'in_stock',     label: 'In Stock'     },
        { value: 'low_stock',    label: 'Low Stock'    },
        { value: 'out_of_stock', label: 'Out of Stock' },
      ],
    },
    ...(uniqueStores.length > 0 ? [{
      key: 'store',
      label: 'Store / Supplier',
      options: uniqueStores.map((s) => ({ value: s, label: s })),
    }] : []),
    ...(Object.keys(productNames).length > 0 ? [{
      key: 'product',
      label: 'Used For Product',
      options: Object.entries(productNames).map(([id, name]) => ({ value: id, label: name })),
    }] : []),
  ]

  const filteredSupplies = supplies
    .filter((s) => {
      if (filterValues.status) {
        const status = computeStatus(s.qty, s.threshold)
        if (filterValues.status !== status) return false
      }
      if (filterValues.store   && s.store !== filterValues.store)                       return false
      if (filterValues.product && s.linked_product_id !== filterValues.product)         return false
      return true
    })
    .filter((s) =>
      search.length >= 3
        ? s.name.toLowerCase().includes(search.toLowerCase()) ||
          (s.store ?? '').toLowerCase().includes(search.toLowerCase())
        : true
    )

  const STATUS_LABEL = { in_stock: 'In Stock', low_stock: 'Low Stock', out_of_stock: 'Out of Stock' }
  const inventoryExportRows = filteredSupplies.map((s) => ({
    item:           s.name,
    supplier:       s.store ?? '',
    linked_product: s.linked_product_id ? (productNames[s.linked_product_id] ?? '') : '',
    last_purchase:  s.last_purchased_at ? formatDate(s.last_purchased_at) : '',
    status:         STATUS_LABEL[computeStatus(s.qty, s.threshold)],
    qty:            s.qty,
    threshold:      s.threshold,
    price_per_unit: s.price_per_unit != null ? formatExportAmount(s.price_per_unit) : '',
  }))

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
        <TableOptionsButton
          filterGroups={inventoryFilterGroups}
          filterValue={filterValues}
          onFilterChange={(key, val) => setFilterValues({ ...filterValues, [key]: val })}
          onFilterReset={() => setFilterValues({})}
          hiddenKeys={hiddenKeys}
          onToggleColumn={toggleColumn}
          exportColumns={INVENTORY_EXPORT_COLUMNS}
          exportRows={inventoryExportRows}
          exportFilename="hydra-inventory"
          exportTitle="Inventory"
        />
        {isOwner && (
          <Button size="sm" onClick={() => { setEditingSupply(null); setSupplyModalOpen(true) }}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Item
          </Button>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <SupplyTable
        items={filteredSupplies}
        isLoading={isLoading}
        productNames={productNames}
        onEditClick={(item) => { setEditingSupply(item); setSupplyModalOpen(true) }}
        onDeleteClick={handleDeleteSupply}
        onQuickAdjust={handleQuickAdjust}
        hiddenKeys={hiddenKeys}
        columnWidths={columnWidths}
        onColumnResize={onColumnResize}
        columnOrder={columnOrder}
        onColumnReorder={onColumnReorder}
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

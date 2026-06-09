import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/shared/Modal'
import { SearchInput } from '@/components/shared/SearchInput'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { CustomerList } from '@/features/customers/components/CustomerList'
import { CustomerModal } from '@/features/customers/components/CustomerModal'
import { useCustomers } from '@/features/customers/hooks/useCustomers'
import { useToast } from '@/hooks/use-toast'
import { formatDate, formatExportAmount } from '@/lib/utils'
import { ExportModal, type ExportColumnDef } from '@/components/shared/ExportModal'
import { FilterButton, type FilterGroup } from '@/components/shared/FilterButton'

const CUSTOMER_FILTER_GROUPS: FilterGroup[] = [
  {
    key: 'type',
    label: 'Customer Type',
    options: [
      { value: 'walk_in',  label: 'Walk-in'  },
      { value: 'regular',  label: 'Regular'  },
      { value: 'retailer', label: 'Retailer' },
    ],
  },
]

const CUSTOMER_EXPORT_COLUMNS: ExportColumnDef[] = [
  { key: 'name',       label: 'Name' },                              // visible
  { key: 'type',       label: 'Type' },                              // visible
  { key: 'phone',      label: 'Phone' },                            // visible
  { key: 'messenger',  label: 'Messenger', defaultChecked: false },
  { key: 'address',    label: 'Address' },                          // visible
  { key: 'last_order', label: 'Last Order' },                       // visible
  { key: 'balance',    label: 'Balance Due' },                      // visible
]
import type { Customer } from '@/features/customers/types'

export default function CustomersPage() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [isModalOpen,  setIsModalOpen]  = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters,     setFilters]     = useState<Record<string, string>>({})

  const { data, isLoading, error, addCustomer, updateCustomer, deleteCustomer } = useCustomers()

  const filteredCustomers = data
    .filter((c) => {
      if (filters.type && filters.type !== c.type) return false
      return true
    })
    .filter((c) =>
      searchQuery.length >= 1
        ? c.name.toLowerCase().includes(searchQuery.toLowerCase())
        : true
    )

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setIsModalOpen(true)
  }

  const customerExportRows = data.map((c) => ({
    name:       c.name,
    type:       c.type,
    phone:      c.phone ?? '',
    messenger:  c.messenger ?? '',
    address:    c.address ?? '',
    last_order: c.last_ordered_at ? formatDate(c.last_ordered_at + 'T00:00:00') : '',
    balance:    c.total_balance && c.total_balance > 0 ? formatExportAmount(c.total_balance) : '',
  }))

  const handleDelete = async () => {
    if (!deletingCustomer) return
    setIsDeleting(true)
    try {
      await deleteCustomer(deletingCustomer.id)
      toast({ title: 'Customer deleted' })
      setDeletingCustomer(null)
    } catch (e) {
      toast({ title: 'Delete failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div>
      <PageHeader title="Customers" />

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3 mb-4">
        <SearchInput
          onSearch={setSearchQuery}
          placeholder="Search customers…"
          minChars={1}
          className="flex-1"
        />
        <FilterButton
          groups={CUSTOMER_FILTER_GROUPS}
          value={filters}
          onChange={(key, val) => setFilters((prev) => ({ ...prev, [key]: val }))}
          onReset={() => setFilters({})}
        />
        <Button size="sm" onClick={() => { setEditingCustomer(null); setIsModalOpen(true) }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Customer
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : (
        <CustomerList
          customers={filteredCustomers}
          onEdit={openEdit}
          onDelete={setDeletingCustomer}
          onView={(c) => navigate(`/customers/${c.id}`)}
          onExport={() => setIsExportOpen(true)}
        />
      )}

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        title="Customers"
        filename="hydra-customers"
        columns={CUSTOMER_EXPORT_COLUMNS}
        rows={customerExportRows}
      />

      <CustomerModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingCustomer(null) }}
        customer={editingCustomer}
        onAdd={async (input) => { await addCustomer(input) }}
        onUpdate={updateCustomer}
      />

      <Modal isOpen={!!deletingCustomer} onClose={() => setDeletingCustomer(null)} title="Delete Customer" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Delete <span className="font-semibold text-foreground">{deletingCustomer?.name}</span>? Their sales history will remain.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setDeletingCustomer(null)}>Cancel</Button>
            <Button type="button" variant="destructive" className="flex-1" disabled={isDeleting} onClick={handleDelete}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Package, ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/shared/Modal'
import { DataTable } from '@/components/shared/DataTable'
import type { Column } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { formatCurrency, cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/stores/authStore'
import { uploadProductImage } from '@/lib/storage'
import type {
  Product, ProductInput,
  StationSettings, StationSettingsInput,
} from '../types'

// ── Schemas ───────────────────────────────────────────────────────────────────

type ItemType = 'water' | 'ice' | 'addon'

const itemSchema = z.object({
  type: z.enum(['water', 'ice', 'addon']),
  name: z.string().min(1, 'Name is required'),
  price: z.number({ error: 'Enter a valid price' }).min(0),
})

const containerSchema = z.object({
  container_name: z.string().min(1, 'Name is required'),
  container_fee_price: z.number({ error: 'Enter a valid price' }).min(0),
})

type ItemSchema = z.infer<typeof itemSchema>
type ContainerSchema = z.infer<typeof containerSchema>

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<ItemType, string> = {
  water: 'Water',
  ice: 'Ice',
  addon: 'Add-on',
}

const TYPE_ORDER: Record<string, number> = { water: 0, ice: 1, addon: 2 }

// ── Props ─────────────────────────────────────────────────────────────────────

interface ProductsTabProps {
  products: Product[]
  stationSettings: StationSettings | null
  isLoading: boolean
  onAddProduct: (input: ProductInput) => Promise<void>
  onUpdateProduct: (id: string, input: Partial<ProductInput>) => Promise<void>
  onDeleteProduct: (id: string) => Promise<void>
  onUpdateStationSettings: (input: Partial<StationSettingsInput>) => Promise<void>
  supplyProductMap: Record<string, string[]>
}

// ── Unified Item Modal (Product + Add-on) ────────────────────────────────────

interface ItemFormModalProps {
  isOpen: boolean
  onClose: () => void
  editingProduct: Product | null
  defaultType: ItemType
  onAddProduct: (input: ProductInput) => Promise<void>
  onUpdateProduct: (id: string, input: Partial<ProductInput>) => Promise<void>
}

function ItemFormModal({
  isOpen, onClose,
  editingProduct, defaultType,
  onAddProduct, onUpdateProduct,
}: ItemFormModalProps) {
  const { toast } = useToast()
  const stationId = useAuthStore((s) => s.stationId)
  const isEdit = !!editingProduct

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)

  const {
    register, handleSubmit, control, reset, watch,
    formState: { errors, isSubmitting },
  } = useForm<ItemSchema>({
    resolver: zodResolver(itemSchema),
    defaultValues: { type: defaultType, name: '', price: 0 },
  })

  const selectedType = watch('type')

  useEffect(() => {
    if (!isOpen) {
      setImageFile(null)
      setImagePreviewUrl(null)
    }
    if (editingProduct?.image_url) {
      setImagePreviewUrl(editingProduct.image_url)
    }
  }, [isOpen, editingProduct])

  useEffect(() => {
    if (!isOpen) return
    if (editingProduct) {
      reset({
        type: editingProduct.type as ItemType,
        name: editingProduct.name,
        price: editingProduct.price,
      })
    } else {
      reset({ type: defaultType, name: '', price: 0 })
    }
  }, [isOpen, editingProduct, defaultType, reset])

  const onSubmit = handleSubmit(async (values) => {
    try {
      let imageUrl: string | null = editingProduct?.image_url ?? null
      if (imageFile && stationId) {
        imageUrl = await uploadProductImage(stationId, imageFile)
      }

      const productInput: ProductInput = {
        name: values.name,
        type: values.type,
        price: values.price,
        is_active: editingProduct?.is_active ?? true,
        image_url: imageUrl,
      }
      if (editingProduct) {
        await onUpdateProduct(editingProduct.id, productInput)
        toast({ title: `${TYPE_LABELS[values.type]} updated` })
      } else {
        await onAddProduct(productInput)
        toast({ title: `${TYPE_LABELS[values.type]} added` })
      }
      onClose()
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    }
  })

  const pillBase = 'flex-1 rounded-md px-3 py-2 text-sm font-medium border transition-all duration-150 text-center'
  const pillActive = 'bg-primary text-primary-foreground border-primary'
  const pillInactive = 'bg-background text-muted-foreground border-border hover:bg-accent'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `Edit ${TYPE_LABELS[selectedType]}` : 'Add Item'} size="sm">
      <form onSubmit={onSubmit} className="space-y-4">

        {!isEdit && (
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Controller name="type" control={control} render={({ field }) => (
              <div className="flex gap-2">
                {(['water', 'ice', 'addon'] as ItemType[]).map((t) => (
                  <button key={t} type="button" onClick={() => field.onChange(t)}
                    className={cn(pillBase, field.value === t ? pillActive : pillInactive)}>
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            )} />
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Photo</Label>
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
              {imagePreviewUrl ? (
                <img src={imagePreviewUrl} alt="preview" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <label className="cursor-pointer">
              <span className="text-xs text-primary font-medium">
                {imagePreviewUrl ? 'Change photo' : 'Upload photo'}
              </span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setImageFile(file)
                  setImagePreviewUrl(URL.createObjectURL(file))
                }}
              />
            </label>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="item-name">Name</Label>
          <Input
            id="item-name"
            placeholder={selectedType === 'addon' ? 'e.g. Barangay 5, Container Fee' : 'e.g. Gallon Flat'}
            autoFocus
            {...register('name')}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="item-price">
            {selectedType === 'addon' ? 'Price' : 'Price per piece'}
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₱</span>
            <Input id="item-price" type="number" step="0.01" min="0" className="pl-7"
              {...register('price', { valueAsNumber: true })} />
          </div>
          {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Container Fee Modal ───────────────────────────────────────────────────────

interface ContainerModalProps {
  isOpen: boolean
  onClose: () => void
  stationSettings: StationSettings | null
  onSave: (input: Partial<StationSettingsInput>) => Promise<void>
}

function ContainerFeeModal({ isOpen, onClose, stationSettings, onSave }: ContainerModalProps) {
  const { toast } = useToast()
  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<ContainerSchema>({
    resolver: zodResolver(containerSchema),
    defaultValues: { container_name: '', container_fee_price: 0 },
  })

  useEffect(() => {
    reset({
      container_name: stationSettings?.container_name ?? '',
      container_fee_price: stationSettings?.container_fee_price ?? 0,
    })
  }, [stationSettings, reset])

  const onSubmit = handleSubmit(async (values) => {
    try {
      await onSave({
        container_name: values.container_name,
        container_fee_price: values.container_fee_price,
        container_fee_enabled: true,
      })
      toast({ title: 'Container fee saved' })
      onClose()
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    }
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Container Fee" size="sm">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="con-name">Name</Label>
          <Input id="con-name" placeholder="e.g. Slim Bottle, Round Container" autoFocus {...register('container_name')} />
          {errors.container_name && <p className="text-xs text-destructive">{errors.container_name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="con-price">Price per container</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₱</span>
            <Input id="con-price" type="number" step="0.01" min="0" className="pl-7"
              {...register('container_fee_price', { valueAsNumber: true })} />
          </div>
          {errors.container_fee_price && <p className="text-xs text-destructive">{errors.container_fee_price.message}</p>}
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ProductsTab({
  products,
  stationSettings,
  isLoading,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onUpdateStationSettings,
  supplyProductMap,
}: ProductsTabProps) {
  const { toast } = useToast()
  const isOwner = useAuthStore((s) => s.role) === 'owner'

  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [defaultType, setDefaultType] = useState<ItemType>('water')
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [containerModalOpen, setContainerModalOpen] = useState(false)

  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const [isDeletingProduct, setIsDeletingProduct] = useState(false)

  const [sortKey, setSortKey] = useState<'name' | 'price' | 'type'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const openAdd = (type: ItemType) => {
    setEditingProduct(null)
    setDefaultType(type)
    setItemModalOpen(true)
  }

  const openEditProduct = (p: Product) => {
    setEditingProduct(p)
    setDefaultType(p.type as ItemType)
    setItemModalOpen(true)
  }

  const handleSort = (key: string) => {
    const k = key as 'name' | 'price' | 'type'
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(k)
      setSortDir('asc')
    }
  }

  const handleDeleteProduct = async () => {
    if (!deletingProduct) return
    setIsDeletingProduct(true)
    try {
      await onDeleteProduct(deletingProduct.id)
      toast({ title: 'Product deleted' })
      setDeletingProduct(null)
    } catch (e) {
      toast({ title: 'Delete failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setIsDeletingProduct(false)
    }
  }

  const sortedProducts = [...products].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'name') {
      cmp = a.name.localeCompare(b.name)
    } else if (sortKey === 'price') {
      cmp = a.price - b.price
    } else {
      cmp = (TYPE_ORDER[a.type] ?? 0) - (TYPE_ORDER[b.type] ?? 0)
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (p) => (
        <div>
          <p className="text-sm font-medium">{p.name}</p>
          <Badge variant="outline" className="mt-0.5 text-xs">
            {TYPE_LABELS[p.type as ItemType] ?? p.type}
          </Badge>
        </div>
      ),
    },
    {
      key: 'supplies',
      header: 'Supplies Used',
      render: (p) => (
        <span className="text-sm text-muted-foreground">
          {supplyProductMap[p.id]?.join(', ') || '—'}
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      sortable: true,
      render: (p) => (
        <span className="text-sm font-medium">{formatCurrency(p.price)}</span>
      ),
    },
    {
      key: 'activate',
      header: 'Active',
      render: (p) =>
        isOwner ? (
          <Switch
            checked={p.is_active}
            onCheckedChange={(checked) => void onUpdateProduct(p.id, { is_active: checked })}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={cn(
              'h-2 w-2 rounded-full inline-block',
              p.is_active ? 'bg-primary' : 'bg-muted-foreground',
            )}
          />
        ),
    },
    ...(isOwner
      ? ([
          {
            key: 'actions',
            header: '',
            render: (p) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={(e) => { e.stopPropagation(); openEditProduct(p) }}
                  aria-label="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); setDeletingProduct(p) }}
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          },
        ] as Column<Product>[])
      : []),
  ]

  if (isLoading) return <LoadingSkeleton rows={5} />

  return (
    <div className="space-y-4">

      {/* ── Add button (owner only) ─────────────────────────────────────────── */}
      {isOwner && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => openAdd('water')}>
            <Plus className="h-4 w-4 mr-1" />Add Product
          </Button>
        </div>
      )}

      {/* ── Products table ──────────────────────────────────────────────────── */}
      {products.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title="No products yet"
          description="Add water, ice, or add-on products to get started."
        />
      ) : (
        <DataTable
          tableId="products"
          columns={columns}
          data={sortedProducts}
          rowKey={(p) => p.id}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
        />
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      <ItemFormModal
        isOpen={itemModalOpen}
        onClose={() => { setItemModalOpen(false); setEditingProduct(null) }}
        editingProduct={editingProduct}
        defaultType={defaultType}
        onAddProduct={onAddProduct}
        onUpdateProduct={onUpdateProduct}
      />

      <ContainerFeeModal
        isOpen={containerModalOpen}
        onClose={() => setContainerModalOpen(false)}
        stationSettings={stationSettings}
        onSave={onUpdateStationSettings}
      />

      {/* Delete product confirm */}
      <Modal isOpen={!!deletingProduct} onClose={() => setDeletingProduct(null)} title="Delete Product" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Delete <span className="font-semibold text-foreground">{deletingProduct?.name}</span>? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setDeletingProduct(null)}>Cancel</Button>
            <Button type="button" variant="destructive" className="flex-1" disabled={isDeletingProduct} onClick={handleDeleteProduct}>
              {isDeletingProduct ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  )
}

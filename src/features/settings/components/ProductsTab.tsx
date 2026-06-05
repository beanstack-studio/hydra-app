import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Package, ImagePlus, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Modal } from '@/components/shared/Modal'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { formatCurrency, cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/stores/authStore'
import { uploadProductImage } from '@/lib/storage'
import type {
  Product, ProductInput,
  DeliveryZone, DeliveryZoneInput,
  StationSettings, StationSettingsInput,
} from '../types'

// ── Schemas ───────────────────────────────────────────────────────────────────

type ItemType = 'water' | 'ice' | 'addon'

const itemSchema = z.object({
  type: z.enum(['water', 'ice', 'addon']),
  name: z.string().min(1, 'Name is required'),
  price: z.number({ error: 'Enter a valid price' }).min(0),
  is_active: z.boolean(),
})

const containerSchema = z.object({
  container_name: z.string().min(1, 'Name is required'),
  container_fee_price: z.number({ error: 'Enter a valid price' }).min(0),
})

type ItemSchema = z.infer<typeof itemSchema>
type ContainerSchema = z.infer<typeof containerSchema>

// ── Props ─────────────────────────────────────────────────────────────────────

interface ProductsTabProps {
  products: Product[]
  deliveryZones: DeliveryZone[]
  stationSettings: StationSettings | null
  isLoading: boolean
  onAddProduct: (input: ProductInput) => Promise<void>
  onUpdateProduct: (id: string, input: Partial<ProductInput>) => Promise<void>
  onDeleteProduct: (id: string) => Promise<void>
  onAddZone: (input: DeliveryZoneInput) => Promise<void>
  onUpdateZone: (id: string, input: Partial<DeliveryZoneInput>) => Promise<void>
  onDeleteZone: (id: string) => Promise<void>
  onUpdateStationSettings: (input: Partial<StationSettingsInput>) => Promise<void>
}

// ── Unified Item Modal (Product + Add-on) ────────────────────────────────────

const TYPE_LABELS: Record<ItemType, string> = {
  water: 'Water',
  ice: 'Ice',
  addon: 'Add-on',
}

interface ItemFormModalProps {
  isOpen: boolean
  onClose: () => void
  editingProduct: Product | null
  editingZone: DeliveryZone | null
  defaultType: ItemType
  onAddProduct: (input: ProductInput) => Promise<void>
  onUpdateProduct: (id: string, input: Partial<ProductInput>) => Promise<void>
  onAddZone: (input: DeliveryZoneInput) => Promise<void>
  onUpdateZone: (id: string, input: Partial<DeliveryZoneInput>) => Promise<void>
}

function ItemFormModal({
  isOpen, onClose,
  editingProduct, editingZone, defaultType,
  onAddProduct, onUpdateProduct, onAddZone, onUpdateZone,
}: ItemFormModalProps) {
  const { toast } = useToast()
  const stationId = useAuthStore((s) => s.stationId)
  const isEdit = !!(editingProduct || editingZone)

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)

  const {
    register, handleSubmit, control, reset, watch,
    formState: { errors, isSubmitting },
  } = useForm<ItemSchema>({
    resolver: zodResolver(itemSchema),
    defaultValues: { type: defaultType, name: '', price: 0, is_active: true },
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
        is_active: editingProduct.is_active,
      })
    } else if (editingZone) {
      reset({ type: 'addon', name: editingZone.name, price: editingZone.price, is_active: editingZone.is_active })
    } else {
      reset({ type: defaultType, name: '', price: 0, is_active: true })
    }
  }, [isOpen, editingProduct, editingZone, defaultType, reset])

  const onSubmit = handleSubmit(async (values) => {
    try {
      let imageUrl: string | null = editingProduct?.image_url ?? null
      if (imageFile && stationId) {
        imageUrl = await uploadProductImage(stationId, imageFile)
      }

      if (editingZone) {
        // Legacy: editing an existing delivery zone entry
        await onUpdateZone(editingZone.id, { name: values.name, price: values.price, is_active: values.is_active })
        toast({ title: 'Add-on updated' })
      } else {
        const productInput: ProductInput = {
          name: values.name,
          type: values.type,
          price: values.price,
          is_active: values.is_active,
          image_url: imageUrl,
        }
        if (editingProduct) {
          await onUpdateProduct(editingProduct.id, productInput)
          toast({ title: `${TYPE_LABELS[values.type]} updated` })
        } else {
          await onAddProduct(productInput)
          toast({ title: `${TYPE_LABELS[values.type]} added` })
        }
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

        <div className="flex gap-3 items-end">
          <div className="flex-1 space-y-1.5">
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
          {isEdit && (
            <div className="flex flex-col items-center gap-1 pb-0.5">
              <Label htmlFor="item-active" className="text-xs text-muted-foreground cursor-pointer">Active</Label>
              <Controller name="is_active" control={control} render={({ field }) => (
                <Switch id="item-active" checked={field.value} onCheckedChange={field.onChange} />
              )} />
            </div>
          )}
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

// ── Row component (shared by all sections) ────────────────────────────────────

interface ItemRowProps {
  label: string
  sub: string
  onEdit?: () => void
  onDelete?: () => void
  inactive?: boolean
}

function ItemRow({ label, sub, onEdit, onDelete, inactive }: ItemRowProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className={cn('shrink-0 h-2 w-2 rounded-full', inactive ? 'bg-muted-foreground' : 'bg-primary')} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{label}</p>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
      </div>
      {(onEdit || onDelete) && (
        <div className="flex items-center gap-1 shrink-0 ml-3">
          {onEdit && (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit} aria-label="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={onDelete} aria-label="Delete">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ProductsTab({
  products,
  deliveryZones,
  stationSettings,
  isLoading,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAddZone,
  onUpdateZone,
  onDeleteZone,
  onUpdateStationSettings,
}: ProductsTabProps) {
  const { toast } = useToast()
  const isOwner = useAuthStore((s) => s.role) === 'owner'

  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [defaultType, setDefaultType] = useState<ItemType>('water')
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null)
  const [containerModalOpen, setContainerModalOpen] = useState(false)

  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const [isDeletingProduct, setIsDeletingProduct] = useState(false)
  const [deletingZone, setDeletingZone] = useState<DeliveryZone | null>(null)
  const [isDeletingZone, setIsDeletingZone] = useState(false)

  type SortState = { key: 'name' | 'price'; dir: 'asc' | 'desc' }
  const [waterSort, setWaterSort] = useState<SortState>({ key: 'name', dir: 'asc' })
  const [iceSort,   setIceSort]   = useState<SortState>({ key: 'name', dir: 'asc' })
  const [addonSort, setAddonSort] = useState<SortState>({ key: 'name', dir: 'asc' })

  const toggleSort = (
    setState: Dispatch<SetStateAction<SortState>>,
    current: SortState,
    key: 'name' | 'price',
  ) => {
    setState(current.key === key
      ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' }
    )
  }

  const openAdd = (type: ItemType) => {
    setEditingProduct(null)
    setEditingZone(null)
    setDefaultType(type)
    setItemModalOpen(true)
  }

  const openEditProduct = (p: Product) => {
    setEditingProduct(p)
    setEditingZone(null)
    setDefaultType(p.type as ItemType)
    setItemModalOpen(true)
  }

  const openEditZone = (z: DeliveryZone) => {
    setEditingZone(z)
    setEditingProduct(null)
    setDefaultType('addon')
    setItemModalOpen(true)
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

  const handleDeleteZone = async () => {
    if (!deletingZone) return
    setIsDeletingZone(true)
    try {
      await onDeleteZone(deletingZone.id)
      toast({ title: 'Add-on deleted' })
      setDeletingZone(null)
    } catch (e) {
      toast({ title: 'Delete failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setIsDeletingZone(false)
    }
  }

  if (isLoading) return <LoadingSkeleton rows={5} />

  const sortProducts = (list: Product[], sort: { key: 'name' | 'price'; dir: 'asc' | 'desc' }) =>
    [...list].sort((a, b) => {
      const cmp = sort.key === 'price' ? a.price - b.price : a.name.localeCompare(b.name)
      return sort.dir === 'asc' ? cmp : -cmp
    })

  const waterProducts = sortProducts(products.filter((p) => p.type === 'water'), waterSort)
  const iceProducts   = sortProducts(products.filter((p) => p.type === 'ice'), iceSort)
  const addonProducts = sortProducts(products.filter((p) => p.type === 'addon'), addonSort)

  const containerActive = stationSettings?.container_fee_enabled ?? false
  const containerName   = stationSettings?.container_name || 'Not configured'
  const containerPrice  = stationSettings?.container_fee_price ?? 0

  const SortIcon = ({ dir }: { dir: 'asc' | 'desc' | null }) => {
    if (dir === 'asc')  return <ArrowUp className="h-3 w-3" />
    if (dir === 'desc') return <ArrowDown className="h-3 w-3" />
    return <ArrowUpDown className="h-3 w-3 opacity-40" />
  }

  const TableHead = ({ sort, onSort }: { sort: SortState; onSort: (k: 'name' | 'price') => void }) => (
    <thead>
      <tr className="border-b border-border bg-muted/40">
        <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <button type="button" onClick={() => onSort('name')} className="flex items-center gap-1 hover:text-foreground transition-colors">
            Name <SortIcon dir={sort.key === 'name' ? sort.dir : null} />
          </button>
        </th>
        <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <button type="button" onClick={() => onSort('price')} className="flex items-center gap-1 hover:text-foreground transition-colors">
            Price <SortIcon dir={sort.key === 'price' ? sort.dir : null} />
          </button>
        </th>
        <th className="px-3 py-2.5" />
      </tr>
    </thead>
  )

  const ProductRow = ({ p }: { p: Product }) => (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-2.5 text-sm font-medium">{p.name}</td>
      <td className="px-3 py-2.5 text-sm text-muted-foreground">
        {formatCurrency(p.price)}
      </td>
      {isOwner && (
        <td className="px-3 py-2.5">
          <div className="flex items-center justify-end gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditProduct(p)}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingProduct(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </td>
      )}
    </tr>
  )

  return (
    <div className="space-y-4">

      {/* ── Single Add button (owner only) ─────────────────────────────────── */}
      {isOwner && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => openAdd('water')}>
            <Plus className="h-4 w-4 mr-1" />Add Product
          </Button>
        </div>
      )}

      {/* ── Phone: stacked sections ─────────────────────────────────────────── */}
      <div className="md:hidden space-y-8">
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Water</h2>
          {waterProducts.length === 0
            ? <EmptyState icon={<Package className="h-6 w-6" />} title="No water products" description="Add gallon sizes." />
            : <div className="space-y-2">{waterProducts.map((p) => (
                <ItemRow key={p.id} label={p.name} sub={formatCurrency(p.price)}
                  onEdit={isOwner ? () => openEditProduct(p) : undefined}
                  onDelete={isOwner ? () => setDeletingProduct(p) : undefined}
                  inactive={!p.is_active} />
              ))}</div>
          }
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ice</h2>
          {iceProducts.length === 0
            ? <EmptyState icon={<Package className="h-6 w-6" />} title="No ice products" description="Add ice tube sizes." />
            : <div className="space-y-2">{iceProducts.map((p) => (
                <ItemRow key={p.id} label={p.name} sub={formatCurrency(p.price)}
                  onEdit={isOwner ? () => openEditProduct(p) : undefined}
                  onDelete={isOwner ? () => setDeletingProduct(p) : undefined}
                  inactive={!p.is_active} />
              ))}</div>
          }
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add-ons</h2>
          {addonProducts.length === 0 && !containerActive
            ? <EmptyState icon={<Package className="h-6 w-6" />} title="No add-ons" description="Add delivery zones and container fees." />
            : <div className="space-y-2">
                {containerActive && (
                  <ItemRow label={containerName} sub={formatCurrency(containerPrice)}
                    onEdit={isOwner ? () => setContainerModalOpen(true) : undefined} />
                )}
                {addonProducts.map((p) => (
                  <ItemRow key={p.id} label={p.name} sub={formatCurrency(p.price)}
                    onEdit={isOwner ? () => openEditProduct(p) : undefined}
                  onDelete={isOwner ? () => setDeletingProduct(p) : undefined}
                  inactive={!p.is_active} />
                ))}
              </div>
          }
        </section>
      </div>

      {/* ── Tablet+: 3 tables side by side ─────────────────────────────────── */}
      <div className="hidden md:grid md:grid-cols-3 gap-4">

        {/* Water */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Water</h2>
          {waterProducts.length === 0
            ? <EmptyState icon={<Package className="h-6 w-6" />} title="No water products" description="Add gallon sizes." />
            : <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <TableHead sort={waterSort} onSort={(k) => toggleSort(setWaterSort, waterSort, k)} />
                  <tbody>{waterProducts.map((p) => <ProductRow key={p.id} p={p} />)}</tbody>
                </table>
              </div>
          }
        </section>

        {/* Ice */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ice</h2>
          {iceProducts.length === 0
            ? <EmptyState icon={<Package className="h-6 w-6" />} title="No ice products" description="Add ice tube sizes." />
            : <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <TableHead sort={iceSort} onSort={(k) => toggleSort(setIceSort, iceSort, k)} />
                  <tbody>{iceProducts.map((p) => <ProductRow key={p.id} p={p} />)}</tbody>
                </table>
              </div>
          }
        </section>

        {/* Add-ons */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add-ons</h2>
          {addonProducts.length === 0 && !containerActive
            ? <EmptyState icon={<Package className="h-6 w-6" />} title="No add-ons" description="Add delivery zones and fees." />
            : <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <TableHead sort={addonSort} onSort={(k) => toggleSort(setAddonSort, addonSort, k)} />
                  <tbody>
                    {containerActive && (
                      <tr className="border-b border-border last:border-0">
                        <td className="px-3 py-2.5 text-sm font-medium">{containerName}</td>
                        <td className="px-3 py-2.5 text-sm text-muted-foreground">{formatCurrency(containerPrice)}</td>
                        {isOwner && (
                          <td className="px-3 py-2.5">
                            <div className="flex justify-end">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setContainerModalOpen(true)}><Pencil className="h-3.5 w-3.5" /></Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )}
                    {addonProducts.map((p) => <ProductRow key={p.id} p={p} />)}
                  </tbody>
                </table>
              </div>
          }
        </section>

      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      <ItemFormModal
        isOpen={itemModalOpen}
        onClose={() => { setItemModalOpen(false); setEditingProduct(null); setEditingZone(null) }}
        editingProduct={editingProduct}
        editingZone={editingZone}
        defaultType={defaultType}
        onAddProduct={onAddProduct}
        onUpdateProduct={onUpdateProduct}
        onAddZone={onAddZone}
        onUpdateZone={onUpdateZone}
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

      {/* Delete zone confirm */}
      <Modal isOpen={!!deletingZone} onClose={() => setDeletingZone(null)} title="Delete Delivery Zone" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Delete zone <span className="font-semibold text-foreground">{deletingZone?.name}</span>? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setDeletingZone(null)}>Cancel</Button>
            <Button type="button" variant="destructive" className="flex-1" disabled={isDeletingZone} onClick={handleDeleteZone}>
              {isDeletingZone ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  )
}

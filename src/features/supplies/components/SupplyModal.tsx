import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Plus } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import type { Supply, SupplyInput, SupplyProductLink } from '../types'
import type { Product } from '@/features/settings/types'

const supplySchema = z.object({
  name:      z.string().min(1, 'Name is required'),
  threshold: z.number().min(0),
})

type SupplySchema = z.infer<typeof supplySchema>

interface SupplyModalProps {
  isOpen:   boolean
  onClose:  () => void
  supply:   Supply | null
  products: Product[]
  onAdd:    (input: SupplyInput) => Promise<void>
  onUpdate: (id: string, input: Partial<SupplyInput>) => Promise<void>
}

const EMPTY_LINK: SupplyProductLink = { product_id: '', units_per_sale: 1 }

const selectClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function SupplyModal({ isOpen, onClose, supply, products, onAdd, onUpdate }: SupplyModalProps) {
  const { toast } = useToast()
  const [linkRows, setLinkRows] = useState<SupplyProductLink[]>([{ ...EMPTY_LINK }])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplySchema>({
    resolver: zodResolver(supplySchema),
    defaultValues: { name: '', threshold: 0 },
  })

  useEffect(() => {
    if (!isOpen) return
    if (supply) {
      reset({ name: supply.name, threshold: supply.threshold })
      // Prefer junction table links; fallback to single linked_product_id
      const existing =
        supply.supply_product_links && supply.supply_product_links.length > 0
          ? supply.supply_product_links.map((l) => ({ product_id: l.product_id, units_per_sale: l.units_per_sale }))
          : supply.linked_product_id
          ? [{ product_id: supply.linked_product_id, units_per_sale: supply.units_per_sale }]
          : [{ ...EMPTY_LINK }]
      setLinkRows(existing)
    } else {
      reset({ name: '', threshold: 0 })
      setLinkRows([{ ...EMPTY_LINK }])
    }
  }, [supply, isOpen, reset])

  const updateLink = (i: number, field: keyof SupplyProductLink, value: string | number) => {
    setLinkRows((prev) => prev.map((row, idx) => idx === i ? { ...row, [field]: value } : row))
  }
  const addLink    = () => setLinkRows((prev) => [...prev, { ...EMPTY_LINK }])
  const removeLink = (i: number) => setLinkRows((prev) => prev.filter((_, idx) => idx !== i))

  const onSubmit = handleSubmit(async (values) => {
    try {
      const validLinks = linkRows.filter((l) => l.product_id !== '')
      // Backward-compat: keep first link in linked_product_id column too
      const firstLink = validLinks[0] ?? null

      const partial: Partial<SupplyInput> = {
        name:              values.name,
        threshold:         values.threshold,
        linked_product_id: firstLink?.product_id ?? null,
        units_per_sale:    firstLink?.units_per_sale ?? 1,
        product_links:     validLinks,
      }

      if (supply) {
        await onUpdate(supply.id, partial)
        toast({ title: 'Item updated' })
      } else {
        await onAdd({
          ...partial,
          type:              'supply',
          qty:               0,
          price_per_unit:    null,
          store:             null,
          last_purchased_at: null,
        } as SupplyInput)
        toast({ title: 'Item added' })
      }
      onClose()
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : 'Something went wrong', variant: 'destructive' })
    }
  })

  const sellableProducts = products.filter((p) => p.type === 'water' || p.type === 'ice')

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={supply ? 'Edit Item' : 'Add Item'} size="sm">
      <form onSubmit={onSubmit} className="space-y-4">

        {/* Row 1: Name + Low Stock Alert */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sup-name">Item Name <span className="text-destructive">*</span></Label>
            <Input id="sup-name" placeholder="e.g. Ice Bag 1kg" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sup-threshold">Low Stock Alert</Label>
            <Input
              id="sup-threshold"
              type="number"
              min={0}
              step="any"
              {...register('threshold', { valueAsNumber: true })}
            />
            <p className="text-xs text-muted-foreground">Warn when qty drops here.</p>
          </div>
        </div>

        {/* Product links */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Auto-deduct when sold</Label>
            <span className="text-xs text-muted-foreground">Product · Units/sale</span>
          </div>

          {linkRows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={row.product_id}
                onChange={(e) => updateLink(i, 'product_id', e.target.value)}
                className={selectClass}
              >
                <option value="">— None —</option>
                {sellableProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <Input
                type="number"
                min={0.01}
                step="any"
                value={row.product_id ? row.units_per_sale : ''}
                onChange={(e) => updateLink(i, 'units_per_sale', parseFloat(e.target.value) || 1)}
                disabled={!row.product_id}
                placeholder="1"
                className="w-20 shrink-0"
              />
              {linkRows.length > 1 && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeLink(i)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-primary gap-1 px-1"
            onClick={addLink}
          >
            <Plus className="h-3 w-3" />
            Add another product
          </Button>
          <p className="text-xs text-muted-foreground">
            Deducts this item from stock on every sale of the linked product.
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : supply ? 'Save Changes' : 'Add Item'}
          </Button>
        </div>

      </form>
    </Modal>
  )
}

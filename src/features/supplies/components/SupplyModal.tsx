import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import type { Supply, SupplyInput } from '../types'
import type { Product } from '@/features/settings/types'

const supplySchema = z.object({
  name:              z.string().min(1, 'Name is required'),
  threshold:         z.number().min(0),
  linked_product_id: z.string().nullable(),
  units_per_sale:    z.number().min(0.01),
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

export function SupplyModal({ isOpen, onClose, supply, products, onAdd, onUpdate }: SupplyModalProps) {
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SupplySchema>({
    resolver: zodResolver(supplySchema),
    defaultValues: {
      name:              '',
      threshold:         0,
      linked_product_id: null,
      units_per_sale:    1,
    },
  })

  const linkedProductId = watch('linked_product_id')

  useEffect(() => {
    if (!isOpen) return
    if (supply) {
      reset({
        name:              supply.name,
        threshold:         supply.threshold,
        linked_product_id: supply.linked_product_id ?? null,
        units_per_sale:    supply.units_per_sale,
      })
    } else {
      reset({ name: '', threshold: 0, linked_product_id: null, units_per_sale: 1 })
    }
  }, [supply, isOpen, reset])

  const selectClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  const onSubmit = handleSubmit(async (values) => {
    try {
      const partial: Partial<SupplyInput> = {
        name:              values.name,
        threshold:         values.threshold,
        linked_product_id: values.linked_product_id || null,
        units_per_sale:    values.units_per_sale,
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

        {/* Row 2: Auto-deduct product + Units per sale */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sup-linked">Auto-deduct when sold</Label>
            <select
              id="sup-linked"
              value={linkedProductId ?? ''}
              onChange={(e) => setValue('linked_product_id', e.target.value || null)}
              className={selectClass}
            >
              <option value="">— None —</option>
              {sellableProducts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Deducts on every sale of this product.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sup-units">Units per sale</Label>
            <Input
              id="sup-units"
              type="number"
              min={0.01}
              step="any"
              disabled={!linkedProductId}
              {...register('units_per_sale', { valueAsNumber: true })}
            />
            <p className="text-xs text-muted-foreground">How many units deducted per sale.</p>
          </div>
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

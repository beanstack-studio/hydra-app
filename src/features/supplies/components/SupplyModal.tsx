import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/shared/Modal'
import { DatePickerInput } from '@/components/shared/DatePickerInput'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { formatInTimeZone } from 'date-fns-tz'
import { PH_TZ } from '@/lib/utils'
import type { Supply, SupplyInput } from '../types'
import type { Product } from '@/features/settings/types'

const supplySchema = z.object({
  name:              z.string().min(1, 'Name is required'),
  qty:               z.number({ message: 'Enter qty' }).min(0),
  price_per_unit:    z.number().min(0).nullable(),
  store:             z.string().nullable(),
  last_purchased_at: z.string().nullable(),
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
  onUpdate: (id: string, input: SupplyInput) => Promise<void>
}

export function SupplyModal({ isOpen, onClose, supply, products, onAdd, onUpdate }: SupplyModalProps) {
  const { toast } = useToast()
  const todayPH = formatInTimeZone(new Date(), PH_TZ, 'yyyy-MM-dd')

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SupplySchema>({
    resolver: zodResolver(supplySchema),
    defaultValues: {
      name:              '',
      qty:               0,
      price_per_unit:    null,
      store:             null,
      last_purchased_at: null,
      threshold:         0,
      linked_product_id: null,
      units_per_sale:    1,
    },
  })

  const lastPurchased   = watch('last_purchased_at')
  const linkedProductId = watch('linked_product_id')

  useEffect(() => {
    if (!isOpen) return
    if (supply) {
      reset({
        name:              supply.name,
        qty:               supply.qty,
        price_per_unit:    supply.price_per_unit,
        store:             supply.store ?? null,
        last_purchased_at: supply.last_purchased_at ?? null,
        threshold:         supply.threshold,
        linked_product_id: supply.linked_product_id ?? null,
        units_per_sale:    supply.units_per_sale,
      })
    } else {
      reset({
        name:              '',
        qty:               0,
        price_per_unit:    null,
        store:             null,
        last_purchased_at: todayPH,
        threshold:         0,
        linked_product_id: null,
        units_per_sale:    1,
      })
    }
  }, [supply, isOpen, reset, todayPH])

  const selectClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  const onSubmit = handleSubmit(async (values) => {
    try {
      const input: SupplyInput = {
        name:              values.name,
        type:              'supply',
        qty:               values.qty,
        price_per_unit:    values.price_per_unit,
        store:             values.store || null,
        last_purchased_at: values.last_purchased_at || null,
        threshold:         values.threshold,
        linked_product_id: values.linked_product_id || null,
        units_per_sale:    values.units_per_sale,
      }
      if (supply) {
        await onUpdate(supply.id, input)
        toast({ title: 'Item updated' })
      } else {
        await onAdd(input)
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

        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="sup-name">Item Name <span className="text-destructive">*</span></Label>
          <Input id="sup-name" placeholder="e.g. Ice Bag 1kg" {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        {/* Qty + Threshold */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sup-qty">Qty on Hand <span className="text-destructive">*</span></Label>
            <Input id="sup-qty" type="number" min={0} step="any" {...register('qty', { valueAsNumber: true })} />
            {errors.qty && <p className="text-xs text-destructive">{errors.qty.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sup-threshold">Low Stock Alert at</Label>
            <Input id="sup-threshold" type="number" min={0} step="any" {...register('threshold', { valueAsNumber: true })} />
          </div>
        </div>

        {/* Price + Store */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sup-price">Price / pc</Label>
            <Controller
              name="price_per_unit"
              control={control}
              render={({ field }) => (
                <CurrencyInput id="sup-price" value={field.value} onChange={(v) => field.onChange(v ?? null)} />
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sup-store">Store / Supplier</Label>
            <Input id="sup-store" placeholder="e.g. SM Hypermarket" {...register('store')} />
          </div>
        </div>

        {/* Last Purchased */}
        <div className="space-y-1.5">
          <Label>Last Purchased</Label>
          <DatePickerInput
            id="sup-last-purchased"
            value={lastPurchased ?? ''}
            onChange={(v) => setValue('last_purchased_at', v || null)}
          />
        </div>

        {/* Linked Product */}
        <div className="space-y-1.5">
          <Label htmlFor="sup-linked">Auto-deduct when product sold</Label>
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
          <p className="text-xs text-muted-foreground">Select a product to deduct this item from stock when a sale is recorded.</p>
        </div>

        {/* Units per sale */}
        {linkedProductId && (
          <div className="space-y-1.5">
            <Label htmlFor="sup-units">Units used per sale</Label>
            <Input
              id="sup-units"
              type="number"
              min={0.01}
              step="any"
              className="w-28"
              {...register('units_per_sale', { valueAsNumber: true })}
            />
          </div>
        )}

        {/* Actions */}
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

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { useToast } from '@/hooks/use-toast'
import { cn, cleanPhone, toTitleCase } from '@/lib/utils'
import type { Customer, CustomerInput, CustomerType } from '../types'

const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['walk_in', 'regular', 'retailer']),
  phone: z.string(),
  messenger: z.string(),
  address: z.string(),
})

type CustomerSchema = z.infer<typeof customerSchema>

const CUSTOMER_TYPES: { value: CustomerType; label: string }[] = [
  { value: 'regular', label: 'Regular' },
  { value: 'retailer', label: 'Retailer' },
]

interface CustomerModalProps {
  isOpen: boolean
  onClose: () => void
  customer: Customer | null
  onAdd: (input: CustomerInput) => Promise<void>
  onUpdate: (id: string, input: Partial<CustomerInput>) => Promise<void>
}

export function CustomerModal({ isOpen, onClose, customer, onAdd, onUpdate }: CustomerModalProps) {
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerSchema>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: '', type: 'regular' as CustomerType, phone: '', messenger: '', address: '' },
  })

  useEffect(() => {
    if (customer) {
      reset({
        name: customer.name,
        type: customer.type,
        phone: customer.phone ?? '',
        messenger: customer.messenger ?? '',
        address: customer.address ?? '',
      })
    } else {
      reset({ name: '', type: 'regular', phone: '', messenger: '', address: '' })
    }
  }, [customer, reset])

  const onSubmit = handleSubmit(async (values) => {
    try {
      const input: CustomerInput = {
        name: toTitleCase(values.name),
        type: values.type,
        phone: values.phone ? cleanPhone(values.phone) : null,
        messenger: values.messenger || null,
        address: values.address ? toTitleCase(values.address) : null,
      }
      if (customer) {
        await onUpdate(customer.id, input)
        toast({ title: 'Customer updated' })
      } else {
        await onAdd(input)
        toast({ title: 'Customer added' })
      }
      onClose()
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    }
  })

  const pillBase = 'flex-1 rounded-md px-3 py-2 text-sm font-medium border transition-all duration-150'
  const pillActive = 'bg-primary text-primary-foreground border-primary'
  const pillInactive = 'bg-background text-muted-foreground border-border hover:bg-accent'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={customer ? 'Edit Customer' : 'Add Customer'} size="sm">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="cust-name">Name *</Label>
          <Input id="cust-name" placeholder="Full name" {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Customer Type</Label>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <div className="flex gap-2">
                {CUSTOMER_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => field.onChange(t.value)}
                    className={cn(pillBase, field.value === t.value ? pillActive : pillInactive)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cust-phone">Phone</Label>
          <PhoneInput name="phone" control={control} id="cust-phone" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cust-msg">Messenger</Label>
          <Input id="cust-msg" placeholder="Facebook name or handle" {...register('messenger')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cust-addr">Address</Label>
          <Input id="cust-addr" placeholder="Barangay, Street…" {...register('address')} />
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : customer ? 'Save Changes' : 'Add Customer'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

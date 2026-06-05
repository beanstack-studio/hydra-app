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
import { formatInTimeZone } from 'date-fns-tz'
import { formatCurrency, PH_TZ } from '@/lib/utils'
import type { Supply } from '../types'

const schema = z.object({
  qty:          z.number({ message: 'Enter qty' }).min(1, 'Must be at least 1'),
  price_per_unit: z.number().min(0),
  expense_date: z.string().min(1, 'Date required'),
})

type Schema = z.infer<typeof schema>

interface LogExpenseModalProps {
  isOpen:   boolean
  onClose:  () => void
  supply:   Supply | null
  onSubmit: (supply: Supply, qty: number, pricePerUnit: number, date: string) => Promise<void>
}

export function LogExpenseModal({ isOpen, onClose, supply, onSubmit }: LogExpenseModalProps) {
  const todayPH = formatInTimeZone(new Date(), PH_TZ, 'yyyy-MM-dd')

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { qty: 1, price_per_unit: 0, expense_date: todayPH },
  })

  const qty           = watch('qty')
  const pricePerUnit  = watch('price_per_unit')
  const expenseDate   = watch('expense_date')
  const total         = (qty ?? 0) * (pricePerUnit ?? 0)

  useEffect(() => {
    if (!isOpen || !supply) return
    reset({
      qty:            1,
      price_per_unit: supply.price_per_unit ?? 0,
      expense_date:   supply.last_purchased_at ?? todayPH,
    })
  }, [isOpen, supply, reset, todayPH])

  const handleFormSubmit = handleSubmit(async (values) => {
    if (!supply) return
    await onSubmit(supply, values.qty, values.price_per_unit, values.expense_date)
    onClose()
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log as Expense" size="sm">
      <div className="mb-4 rounded-md border border-border bg-muted/40 px-3 py-2">
        <p className="text-xs text-muted-foreground">Item</p>
        <p className="text-sm font-semibold text-foreground">{supply?.name}</p>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-4">
        {/* Qty + Price */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="log-qty">Qty Purchased <span className="text-destructive">*</span></Label>
            <Input
              id="log-qty"
              type="number"
              min={1}
              step="any"
              {...register('qty', { valueAsNumber: true })}
            />
            {errors.qty && <p className="text-xs text-destructive">{errors.qty.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="log-price">Price / pc</Label>
            <Controller
              name="price_per_unit"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  id="log-price"
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? 0)}
                />
              )}
            />
          </div>
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <Label>Purchase Date</Label>
          <DatePickerInput
            id="log-date"
            value={expenseDate}
            onChange={(v) => setValue('expense_date', v)}
          />
        </div>

        {/* Total */}
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-sm font-semibold text-foreground">{formatCurrency(total)}</span>
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Log Expense'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

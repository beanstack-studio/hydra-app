import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import type { InventoryItem } from '../types'

const adjustSchema = z.object({
  available_qty:  z.number({ error: 'Enter a valid number' }).min(0, 'Cannot be negative'),
  threshold:      z.number({ error: 'Enter a valid number' }).min(0, 'Cannot be negative'),
  log_as_expense: z.boolean(),
  expense_amount: z.preprocess(
    (v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && isNaN(v as number))) ? null : Number(v),
    z.number().min(0).nullable()
  ),
})

type AdjustSchema = z.infer<typeof adjustSchema>

interface StockAdjustModalProps {
  item: InventoryItem | null
  isOpen: boolean
  onClose: () => void
  onAdjust: (id: string, qty: number, threshold: number, expenseAmount?: number) => Promise<void>
}

export function StockAdjustModal({ item, isOpen, onClose, onAdjust }: StockAdjustModalProps) {
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AdjustSchema>({
    resolver: zodResolver(adjustSchema),
    defaultValues: { available_qty: 0, threshold: 5, log_as_expense: false, expense_amount: null },
  })

  useEffect(() => {
    if (item) {
      reset({ available_qty: item.available_qty, threshold: item.threshold, log_as_expense: false, expense_amount: null })
    }
  }, [item, reset])

  const watchedQty    = watch('available_qty')
  const logAsExpense  = watch('log_as_expense')
  const isRestock     = item !== null && watchedQty > item.available_qty

  const onSubmit = handleSubmit(async (values) => {
    if (!item) return
    try {
      const expenseAmount =
        values.log_as_expense && values.expense_amount && values.expense_amount > 0
          ? values.expense_amount
          : undefined
      await onAdjust(item.id, values.available_qty, values.threshold, expenseAmount)
      toast({ title: 'Stock updated' })
      onClose()
    } catch (e) {
      toast({
        title: 'Update failed',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    }
  })

  if (!item) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Adjust — ${item.product_name}`} size="sm">
      <form onSubmit={onSubmit} className="space-y-4">

        <div className="space-y-1.5">
          <Label htmlFor="avail-qty">Available Qty</Label>
          <Input
            id="avail-qty"
            type="number"
            min="0"
            step="1"
            {...register('available_qty', { valueAsNumber: true })}
          />
          {errors.available_qty && <p className="text-xs text-destructive">{errors.available_qty.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="threshold">Low Stock Threshold</Label>
          <Input
            id="threshold"
            type="number"
            min="0"
            step="1"
            {...register('threshold', { valueAsNumber: true })}
          />
          {errors.threshold && <p className="text-xs text-destructive">{errors.threshold.message}</p>}
          <p className="text-xs text-muted-foreground">Alert shows when qty falls at or below this number.</p>
        </div>

        {/* Expense link — only shown when qty is increasing (restock) */}
        {isRestock && (
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Log as Supplies Expense</p>
                <p className="text-xs text-muted-foreground">Records a purchase expense for this restock</p>
              </div>
              <Controller
                name="log_as_expense"
                control={control}
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Log as expense" />
                )}
              />
            </div>

            {logAsExpense && (
              <div className="space-y-1.5">
                <Label htmlFor="expense-amount">Purchase Cost</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₱</span>
                  <Input
                    id="expense-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-7"
                    placeholder="0.00"
                    {...register('expense_amount')}
                  />
                </div>
                {errors.expense_amount && <p className="text-xs text-destructive">{errors.expense_amount.message}</p>}
              </div>
            )}
          </div>
        )}

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

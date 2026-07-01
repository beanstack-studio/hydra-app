import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { DatePickerInput } from '@/components/shared/DatePickerInput'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { useRestockHistory } from '../hooks/useRestockHistory'
import { formatCurrency, formatDate, nowPH, PH_TZ } from '@/lib/utils'
import { formatInTimeZone } from 'date-fns-tz'
import type { Supply } from '../types'

const restockSchema = z.object({
  qty_added:      z.number().min(1, 'Must add at least 1'),
  supplier:       z.string().optional(),
  price_per_unit: z.number().nullable().optional(),
  purchase_date:  z.string().min(1, 'Select a date'),
  log_as_expense: z.boolean(),
})

type RestockSchema = z.infer<typeof restockSchema>

interface RestockModalProps {
  isOpen:  boolean
  onClose: () => void
  supply:  Supply | null
  onRestock: (
    id: string,
    qtyAdded: number,
    opts: {
      supplier?: string
      pricePerUnit?: number | null
      purchaseDate: string
      logAsExpense: boolean
    }
  ) => Promise<void>
}

export function RestockModal({ isOpen, onClose, supply, onRestock }: RestockModalProps) {
  const todayStr = formatInTimeZone(nowPH(), PH_TZ, 'yyyy-MM-dd')
  const [isSubmitting, setIsSubmitting]   = useState(false)
  const [historyOpen,  setHistoryOpen]    = useState(false)

  const { data: history, isLoading: histLoading } = useRestockHistory(isOpen ? (supply?.id ?? null) : null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<RestockSchema>({
    resolver: zodResolver(restockSchema),
    defaultValues: {
      qty_added:      1,
      supplier:       supply?.store ?? '',
      price_per_unit: supply?.price_per_unit ?? null,
      purchase_date:  todayStr,
      log_as_expense: false,
    },
  })

  useEffect(() => {
    if (isOpen && supply) {
      reset({
        qty_added:      1,
        supplier:       supply.store ?? '',
        price_per_unit: supply.price_per_unit ?? null,
        purchase_date:  todayStr,
        log_as_expense: false,
      })
      setHistoryOpen(false)
    }
  }, [isOpen, supply, reset, todayStr])

  const qtyAdded     = watch('qty_added')
  const pricePerUnit = watch('price_per_unit')
  const estimatedTotal = (pricePerUnit ?? 0) * (qtyAdded ?? 0)
  const showExpenseToggle = estimatedTotal > 0

  const onSubmit = async (values: RestockSchema) => {
    if (!supply) return
    setIsSubmitting(true)
    try {
      await onRestock(supply.id, values.qty_added, {
        supplier:     values.supplier || undefined,
        pricePerUnit: values.price_per_unit ?? null,
        purchaseDate: values.purchase_date,
        logAsExpense: showExpenseToggle ? values.log_as_expense : false,
      })
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!supply) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Restock — ${supply.name}`} size="sm">
      {/* Current stock */}
      <div className="mb-5 rounded-lg border border-border bg-muted/40 px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Current stock</span>
        <span className="text-lg font-bold text-foreground">{supply.qty}</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Qty added */}
        <div className="space-y-1.5">
          <Label>Qty to Add</Label>
          <Controller
            name="qty_added"
            control={control}
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 shrink-0"
                  onClick={() => field.onChange(Math.max(1, (field.value ?? 1) - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <input
                  type="number"
                  min={1}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-center font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={field.value ?? 1}
                  onChange={(e) => field.onChange(Math.max(1, Number(e.target.value)))}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 shrink-0"
                  onClick={() => field.onChange((field.value ?? 1) + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          />
          {errors.qty_added && <p className="text-xs text-destructive">{errors.qty_added.message}</p>}
          <p className="text-xs text-muted-foreground">New total will be {supply.qty + (qtyAdded ?? 0)}</p>
        </div>

        {/* Supplier */}
        <div className="space-y-1.5">
          <Label htmlFor="supplier">Supplier <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            id="supplier"
            placeholder="e.g. SM Supermarket"
            {...register('supplier')}
          />
        </div>

        {/* Price per unit */}
        <div className="space-y-1.5">
          <Label>Price / Unit <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Controller
            name="price_per_unit"
            control={control}
            render={({ field }) => (
              <CurrencyInput
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>

        {/* Purchase date */}
        <div className="space-y-1.5">
          <Label>Purchase Date</Label>
          <Controller
            name="purchase_date"
            control={control}
            render={({ field }) => (
              <DatePickerInput
                value={field.value}
                onChange={field.onChange}
                max={todayStr}
              />
            )}
          />
          {errors.purchase_date && <p className="text-xs text-destructive">{errors.purchase_date.message}</p>}
        </div>

        {/* Estimated total + log as expense toggle */}
        {showExpenseToggle && (
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Estimated total</span>
              <span className="text-sm font-semibold text-foreground">{formatCurrency(estimatedTotal)}</span>
            </div>
            <Controller
              name="log_as_expense"
              control={control}
              render={({ field }) => (
                <div className="flex items-center justify-between">
                  <Label htmlFor="log_as_expense" className="cursor-pointer">Log as expense</Label>
                  <Switch
                    id="log_as_expense"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </div>
              )}
            />
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Restock'}
          </Button>
        </div>
      </form>

      {/* Price history */}
      <div className="mt-5 border-t border-border pt-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-sm font-medium text-foreground"
          onClick={() => setHistoryOpen((o) => !o)}
        >
          <span>Price History</span>
          {historyOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {historyOpen && (
          <div className="mt-3">
            {histLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No restock history yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-foreground">{h.supplier}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(h.restocked_at)} · ×{h.qty_added}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-foreground">{formatCurrency(h.price_per_unit)}/unit</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(h.total_cost)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

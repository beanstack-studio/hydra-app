import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { formatInTimeZone } from 'date-fns-tz'
import { Modal } from '@/components/shared/Modal'
import { DatePickerInput } from '@/components/shared/DatePickerInput'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, nowPH, PH_TZ } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import type { Sale, PaymentMode } from '../types'

const PAYMENT_MODES: { value: 'cash' | 'gcash' | 'maya'; label: string }[] = [
  { value: 'cash',  label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'maya',  label: 'Maya' },
]

const paymentSchema = z.object({
  paid_at: z.string().min(1, 'Payment date is required'),
  amount:  z.number({ invalid_type_error: 'Enter a valid amount' }).min(0.01, 'Amount must be greater than 0'),
  payment_mode: z.string().refine(
    (v): v is 'cash' | 'gcash' | 'maya' => ['cash', 'gcash', 'maya'].includes(v),
    { message: 'Select a payment mode' }
  ),
  remarks: z.string(),
})

type PaymentSchema = z.infer<typeof paymentSchema>

interface RecordPaymentModalProps {
  sale: Sale | null
  isOpen: boolean
  onClose: () => void
  onRecord: (saleId: string, amount: number, paymentMode: PaymentMode, paidAt: string, remarks: string) => Promise<void>
}

export function RecordPaymentModal({ sale, isOpen, onClose, onRecord }: RecordPaymentModalProps) {
  const { toast } = useToast()

  const {
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PaymentSchema>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { paid_at: '', amount: 0, payment_mode: '', remarks: '' },
  })

  useEffect(() => {
    if (sale && isOpen) {
      reset({
        paid_at:      formatInTimeZone(nowPH(), PH_TZ, 'yyyy-MM-dd'),
        amount:       0,
        payment_mode: '',
        remarks:      '',
      })
    }
  }, [sale, isOpen, reset])

  const onSubmit = handleSubmit(async (values) => {
    if (!sale) return
    try {
      await onRecord(sale.id, values.amount, values.payment_mode as PaymentMode, values.paid_at, values.remarks)
      toast({ title: 'Payment recorded' })
      onClose()
    } catch (e) {
      toast({
        title: 'Payment failed',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    }
  })

  const paidAt      = watch('paid_at')
  const paymentMode = watch('payment_mode')

  const selectClass =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  if (!sale) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Payment" size="sm">
      {/* ── Summary ──────────────────────────────────────────────────────── */}
      <div className="mb-4 rounded-md bg-muted/40 px-4 py-3 space-y-0.5">
        <p className="text-sm font-medium">{sale.customer_name}</p>
        <p className="text-xs text-muted-foreground">{sale.product_name} ×{sale.qty}</p>
        <p className="text-xs text-muted-foreground">
          Balance due:{' '}
          <span className="font-semibold text-destructive">{formatCurrency(sale.balance_due)}</span>
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">

        {/* ── Payment Date ──────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="pay-date">Payment Date <span className="text-destructive">*</span></Label>
          <Controller
            name="paid_at"
            control={control}
            render={() => (
              <DatePickerInput
                id="pay-date"
                value={paidAt}
                onChange={(v) => setValue('paid_at', v, { shouldValidate: true })}
              />
            )}
          />
          {errors.paid_at && <p className="text-xs text-destructive">{errors.paid_at.message}</p>}
        </div>

        {/* ── Amount + Payment Mode (2-col) ─────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">Amount Received <span className="text-destructive">*</span></Label>
            <Controller
              name="amount"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  id="pay-amount"
                  value={field.value === 0 ? null : field.value}
                  onChange={(v) => field.onChange(v ?? 0)}
                  max={sale.balance_due}
                  hasError={!!errors.amount}
                />
              )}
            />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-mode">Payment Mode <span className="text-destructive">*</span></Label>
            <select
              id="pay-mode"
              value={paymentMode}
              onChange={(e) => setValue('payment_mode', e.target.value, { shouldValidate: true })}
              className={selectClass}
            >
              <option value="">— Select —</option>
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            {errors.payment_mode && <p className="text-xs text-destructive">{errors.payment_mode.message}</p>}
          </div>
        </div>

        {/* ── Remarks ───────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="pay-remarks">Remarks</Label>
          <Controller
            name="remarks"
            control={control}
            render={({ field }) => (
              <Textarea id="pay-remarks" placeholder="Notes…" rows={2} {...field} />
            )}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Record Payment'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

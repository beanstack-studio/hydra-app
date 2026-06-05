import { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { formatInTimeZone } from 'date-fns-tz'
import { Paperclip, X } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { DatePickerInput } from '@/components/shared/DatePickerInput'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { cn, PH_TZ } from '@/lib/utils'
import type { Expense, ExpenseInput, ExpenseCategory, ExpensePaymentMethod } from '../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'gasoline', label: 'Gasoline' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'other',    label: 'Other' },
]

const PAYMENT_METHODS: { value: ExpensePaymentMethod; label: string }[] = [
  { value: 'cash',        label: 'Cash' },
  { value: 'gcash',       label: 'GCash' },
  { value: 'maya',        label: 'Maya' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'other',       label: 'Other' },
]

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB

// ── Schema ────────────────────────────────────────────────────────────────────

const expenseSchema = z.object({
  category: z.string().refine(
    (v): v is ExpenseCategory =>
      (['gasoline', 'supplies', 'maintenance', 'other', 'labor'] as string[]).includes(v),
    { message: 'Select a category' }
  ),
  expense_date:   z.string().min(1, 'Date is required'),
  amount:         z.number({ invalid_type_error: 'Enter a valid amount' }).min(0.01, 'Amount is required'),
  payment_method: z.enum(['cash', 'gcash', 'maya', 'credit_card', 'other']).nullable(),
  remarks:        z.string().nullable(),
})

type ExpenseSchema = z.infer<typeof expenseSchema>

// ── Props ─────────────────────────────────────────────────────────────────────

interface ExpenseModalProps {
  isOpen: boolean
  onClose: () => void
  expense: Expense | null
  onAdd: (input: ExpenseInput, file?: File) => Promise<void>
  onUpdate: (id: string, input: Partial<ExpenseInput>, file?: File) => Promise<void>
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ExpenseModal({ isOpen, onClose, expense, onAdd, onUpdate }: ExpenseModalProps) {
  const { toast } = useToast()
  const todayPH = formatInTimeZone(new Date(), PH_TZ, 'yyyy-MM-dd')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile,        setSelectedFile]        = useState<File | null>(null)
  const [keepExistingReceipt, setKeepExistingReceipt] = useState(true)

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseSchema>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category:       '',
      expense_date:   todayPH,
      amount:         0,
      payment_method: null,
      remarks:        '',
    },
  })

  const expenseDate       = watch('expense_date')
  const selectedPayMethod = watch('payment_method')

  useEffect(() => {
    if (!isOpen) return
    setSelectedFile(null)
    setKeepExistingReceipt(true)
    if (expense) {
      reset({
        category:       expense.category,
        expense_date:   expense.expense_date,
        amount:         expense.amount,
        payment_method: expense.payment_method ?? null,
        remarks:        expense.remarks ?? '',
      })
    } else {
      reset({
        category:       '',
        expense_date:   todayPH,
        amount:         0,
        payment_method: null,
        remarks:        '',
      })
    }
  }, [expense, isOpen, reset, todayPH])

  const existingReceiptName = expense?.receipt_url
    ? (expense.receipt_url.split('/').pop()?.replace(/^\d+-/, '') ?? 'receipt')
    : null

  const onSubmit = handleSubmit(async (values) => {
    try {
      const baseInput: ExpenseInput = {
        category:       values.category,
        amount:         values.amount,
        expense_date:   values.expense_date,
        payment_method: values.payment_method,
        remarks:        values.remarks || null,
      }

      if (expense) {
        await onUpdate(expense.id, {
          ...baseInput,
          receipt_url: !keepExistingReceipt && !selectedFile ? null : undefined,
        }, selectedFile ?? undefined)
        toast({ title: 'Expense updated' })
      } else {
        await onAdd(baseInput, selectedFile ?? undefined)
        toast({ title: 'Expense added' })
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

  const selectClass =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  const showExistingReceipt = !selectedFile && keepExistingReceipt && !!existingReceiptName

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={expense ? 'Edit Expense' : 'Add Expense'} size="sm">
      <form onSubmit={onSubmit} className="space-y-4">

        {/* ── Category + Date ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="exp-category">Category <span className="text-destructive">*</span></Label>
            <select id="exp-category" {...register('category')} className={selectClass}>
              <option value="" disabled>— Select —</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            {errors.category && (
              <p className="text-xs text-destructive">{errors.category.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-date">Date <span className="text-destructive">*</span></Label>
            <DatePickerInput
              id="exp-date"
              value={expenseDate}
              onChange={(v) => setValue('expense_date', v, { shouldValidate: true })}
            />
            {errors.expense_date && (
              <p className="text-xs text-destructive">{errors.expense_date.message}</p>
            )}
          </div>
        </div>

        {/* ── Amount + Payment Method ───────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="exp-amount">Amount <span className="text-destructive">*</span></Label>
            <Controller
              name="amount"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  id="exp-amount"
                  value={field.value === 0 ? null : field.value}
                  onChange={(v) => field.onChange(v ?? 0)}
                  hasError={!!errors.amount}
                />
              )}
            />
            {errors.amount && (
              <p className="text-xs text-destructive">{errors.amount.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-payment">
              Payment Method
            </Label>
            <select
              id="exp-payment"
              value={selectedPayMethod ?? ''}
              onChange={(e) =>
                setValue(
                  'payment_method',
                  (e.target.value as ExpensePaymentMethod) || null,
                  { shouldValidate: true }
                )
              }
              className={selectClass}
            >
              <option value="">— Select —</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Receipt ──────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label>Receipt <span className="font-normal text-muted-foreground">(5 MB max)</span></Label>

          {selectedFile ? (
            <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-sm">{selectedFile.name}</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                className="text-muted-foreground hover:text-foreground transition-colors duration-150"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : showExistingReceipt ? (
            <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-sm text-muted-foreground">{existingReceiptName}</span>
              <button
                type="button"
                onClick={() => setKeepExistingReceipt(false)}
                className="text-muted-foreground hover:text-foreground transition-colors duration-150"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 w-full rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors duration-150"
            >
              <Paperclip className="h-3.5 w-3.5" />
              <span>Attach receipt (image or PDF)</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              if (file.size > MAX_FILE_BYTES) {
                toast({
                  title: 'File too large',
                  description: 'Receipt must be 5 MB or less.',
                  variant: 'destructive',
                })
                if (fileInputRef.current) fileInputRef.current.value = ''
                return
              }
              setSelectedFile(file)
              setKeepExistingReceipt(false)
            }}
          />
        </div>

        {/* ── Remarks ──────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="exp-remarks">
            Remarks
          </Label>
          <Textarea
            id="exp-remarks"
            placeholder="Optional notes…"
            rows={2}
            {...register('remarks')}
          />
        </div>

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : expense ? 'Save Changes' : 'Add Expense'}
          </Button>
        </div>

      </form>
    </Modal>
  )
}

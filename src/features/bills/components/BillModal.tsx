import { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Paperclip, X } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { DatePickerInput } from '@/components/shared/DatePickerInput'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { nowPH } from '@/lib/utils'
import type { Bill, BillInput, BillType, BillPaymentMethod } from '../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function generatePeriodOptions(billMonth?: number, billYear?: number): { value: string; label: string }[] {
  const now = nowPH()
  const options: { value: string; label: string }[] = []
  for (let offset = -6; offset <= 3; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    const m = d.getMonth() + 1
    const y = d.getFullYear()
    options.push({ value: `${y}-${m}`, label: `${MONTHS[m - 1]} ${y}` })
  }
  // Ensure the bill's existing period is always present even if outside the window
  if (billMonth !== undefined && billYear !== undefined) {
    const key = `${billYear}-${billMonth}`
    if (!options.some((o) => o.value === key)) {
      options.unshift({ value: key, label: `${MONTHS[billMonth - 1]} ${billYear}` })
    }
  }
  return options
}

const CATEGORIES: { value: BillType; label: string }[] = [
  { value: 'electricity', label: 'Electricity' },
  { value: 'water',       label: 'Water' },
  { value: 'internet',    label: 'Internet' },
  { value: 'rent',        label: 'Rent' },
  { value: 'bank',        label: 'Bank' },
  { value: 'other',       label: 'Other' },
]

const PAYMENT_METHODS: { value: BillPaymentMethod; label: string }[] = [
  { value: 'cash',        label: 'Cash' },
  { value: 'gcash',       label: 'GCash' },
  { value: 'maya',        label: 'Maya' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'other',       label: 'Other' },
]

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB

// ── Schema ────────────────────────────────────────────────────────────────────

const billSchema = z.object({
  bill_type: z.string().min(1, 'Select a category'),
  period:    z.string().min(1, 'Select a period'),
  amount:    z.number({ message: 'Enter a valid amount' }).min(0.01, 'Amount is required'),
  due_date:       z.string().nullable(),
  date_paid:      z.string().nullable(),
  payment_method: z.string().nullable(),
  description:    z.string().nullable(),
})

type BillSchema = z.infer<typeof billSchema>

// ── Props ─────────────────────────────────────────────────────────────────────

interface BillModalProps {
  isOpen: boolean
  onClose: () => void
  bill: Bill | null
  onAdd: (input: BillInput, billFile?: File, paymentFile?: File) => Promise<void>
  onUpdate: (id: string, input: Partial<BillInput>, billFile?: File, paymentFile?: File) => Promise<void>
}

// ── File attachment row ───────────────────────────────────────────────────────

interface AttachRowProps {
  label: string
  selectedFile: File | null
  existingName: string | null
  keepExisting: boolean
  onSelect: (file: File) => void
  onClearNew: () => void
  onClearExisting: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
}

function AttachRow({
  label, selectedFile, existingName, keepExisting,
  onSelect, onClearNew, onClearExisting, inputRef,
}: AttachRowProps) {
  const { toast } = useToast()

  return (
    <div className="space-y-1.5">
      <Label>{label} <span className="font-normal text-muted-foreground">(5 MB max)</span></Label>

      {selectedFile ? (
        <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
          <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-sm">{selectedFile.name}</span>
          <button type="button" onClick={onClearNew}
            className="text-muted-foreground hover:text-foreground transition-colors duration-150">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : keepExisting && existingName ? (
        <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
          <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-sm text-muted-foreground">{existingName}</span>
          <button type="button" onClick={onClearExisting}
            className="text-muted-foreground hover:text-foreground transition-colors duration-150">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 w-full rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors duration-150"
        >
          <Paperclip className="h-3.5 w-3.5" />
          <span>Attach file (image or PDF)</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          if (file.size > MAX_FILE_BYTES) {
            toast({ title: 'File too large', description: 'Must be 5 MB or less.', variant: 'destructive' })
            if (inputRef.current) inputRef.current.value = ''
            return
          }
          onSelect(file)
        }}
      />
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BillModal({ isOpen, onClose, bill, onAdd, onUpdate }: BillModalProps) {
  const { toast } = useToast()

  const billFileRef     = useRef<HTMLInputElement>(null)
  const paymentFileRef  = useRef<HTMLInputElement>(null)

  const [billFile,            setBillFile]            = useState<File | null>(null)
  const [paymentFile,         setPaymentFile]         = useState<File | null>(null)
  const [keepBillReceipt,     setKeepBillReceipt]     = useState(true)
  const [keepPaymentReceipt,  setKeepPaymentReceipt]  = useState(true)

  const now = nowPH()
  const defaultPeriod = `${now.getFullYear()}-${now.getMonth() + 1}`

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BillSchema>({
    resolver: zodResolver(billSchema),
    defaultValues: { bill_type: '', period: defaultPeriod, amount: 0, due_date: '', date_paid: '', payment_method: '', description: '' },
  })

  const dueDate       = watch('due_date')
  const datePaid      = watch('date_paid')
  const paymentMethod = watch('payment_method')
  const period        = watch('period')

  const periodOptions = generatePeriodOptions(bill?.month, bill?.year)

  useEffect(() => {
    if (!isOpen) return
    setBillFile(null)
    setPaymentFile(null)
    setKeepBillReceipt(true)
    setKeepPaymentReceipt(true)
    const freshNow = nowPH()
    const freshDefault = `${freshNow.getFullYear()}-${freshNow.getMonth() + 1}`
    if (bill) {
      reset({
        bill_type:      bill.bill_type,
        period:         `${bill.year}-${bill.month}`,
        amount:         bill.amount,
        due_date:       bill.due_date ?? '',
        date_paid:      bill.date_paid ?? '',
        payment_method: bill.payment_method ?? '',
        description:    bill.description ?? '',
      })
    } else {
      reset({ bill_type: '', period: freshDefault, amount: 0, due_date: '', date_paid: '', payment_method: '', description: '' })
    }
  }, [bill, isOpen, reset])

  const existingBillReceiptName = bill?.bill_receipt_url
    ? (bill.bill_receipt_url.split('/').pop()?.replace(/^\d+-/, '') ?? 'bill')
    : null

  const existingPaymentReceiptName = bill?.payment_receipt_url
    ? (bill.payment_receipt_url.split('/').pop()?.replace(/^\d+-/, '') ?? 'receipt')
    : null

  const onSubmit = handleSubmit(async (values) => {
    try {
      const [yearStr, monthStr] = values.period.split('-')
      const selectedYear  = parseInt(yearStr, 10)
      const selectedMonth = parseInt(monthStr, 10)

      const input: BillInput = {
        bill_type:      values.bill_type as BillType,
        amount:         values.amount,
        month:          selectedMonth,
        year:           selectedYear,
        due_date:       values.due_date || null,
        date_paid:      values.date_paid || null,
        payment_method: (values.payment_method as BillPaymentMethod) || null,
        description:    values.description || null,
        bill_receipt_url:     !keepBillReceipt && !billFile ? null : undefined,
        payment_receipt_url:  !keepPaymentReceipt && !paymentFile ? null : undefined,
      }

      if (bill) {
        await onUpdate(bill.id, input, billFile ?? undefined, paymentFile ?? undefined)
        toast({ title: 'Bill updated' })
      } else {
        await onAdd(input, billFile ?? undefined, paymentFile ?? undefined)
        toast({ title: 'Bill added' })
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={bill ? 'Edit Bill' : 'Add Bill'} size="sm">
      <form onSubmit={onSubmit} className="space-y-4">

        {/* ── Category + Period ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="bill-category">Category <span className="text-destructive">*</span></Label>
            <select id="bill-category" {...register('bill_type')} className={selectClass}>
              <option value="" disabled>— Select —</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            {errors.bill_type && <p className="text-xs text-destructive">{errors.bill_type.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bill-period">Period <span className="text-destructive">*</span></Label>
            <select
              id="bill-period"
              value={period ?? ''}
              onChange={(e) => setValue('period', e.target.value, { shouldValidate: true })}
              className={selectClass}
            >
              {periodOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {errors.period && <p className="text-xs text-destructive">{errors.period.message}</p>}
          </div>
        </div>

        {/* ── Due Date + Date Paid ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="bill-due">Due Date</Label>
            <DatePickerInput
              id="bill-due"
              value={dueDate ?? ''}
              onChange={(v) => setValue('due_date', v || null, { shouldValidate: true })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bill-paid">Date Paid</Label>
            <DatePickerInput
              id="bill-paid"
              value={datePaid ?? ''}
              onChange={(v) => setValue('date_paid', v || null, { shouldValidate: true })}
            />
          </div>
        </div>

        {/* ── Amount + Payment Method ───────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="bill-amount">Amount <span className="text-destructive">*</span></Label>
            <Controller
              name="amount"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  id="bill-amount"
                  value={field.value === 0 ? null : field.value}
                  onChange={(v) => field.onChange(v ?? 0)}
                  hasError={!!errors.amount}
                />
              )}
            />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bill-payment">Payment Method</Label>
            <select
              id="bill-payment"
              value={paymentMethod ?? ''}
              onChange={(e) =>
                setValue('payment_method', (e.target.value as BillPaymentMethod) || null, { shouldValidate: true })
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

        {/* ── Bill + Receipt Uploads (2-col on md+) ────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AttachRow
            label="Bill Document"
            selectedFile={billFile}
            existingName={existingBillReceiptName}
            keepExisting={keepBillReceipt}
            onSelect={(f) => { setBillFile(f); setKeepBillReceipt(false) }}
            onClearNew={() => { setBillFile(null); if (billFileRef.current) billFileRef.current.value = '' }}
            onClearExisting={() => setKeepBillReceipt(false)}
            inputRef={billFileRef}
          />
          <AttachRow
            label="Payment Receipt"
            selectedFile={paymentFile}
            existingName={existingPaymentReceiptName}
            keepExisting={keepPaymentReceipt}
            onSelect={(f) => { setPaymentFile(f); setKeepPaymentReceipt(false) }}
            onClearNew={() => { setPaymentFile(null); if (paymentFileRef.current) paymentFileRef.current.value = '' }}
            onClearExisting={() => setKeepPaymentReceipt(false)}
            inputRef={paymentFileRef}
          />
        </div>

        {/* ── Remarks ──────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="bill-remarks">Remarks</Label>
          <Textarea id="bill-remarks" placeholder="Optional notes…" rows={2} {...register('description')} />
        </div>

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : bill ? 'Save Changes' : 'Add Bill'}
          </Button>
        </div>

      </form>
    </Modal>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Paperclip, X } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { DatePickerInput } from '@/components/shared/DatePickerInput'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate, nowPH, PH_TZ } from '@/lib/utils'
import { formatInTimeZone } from 'date-fns-tz'
import type { Bill } from '../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const BILL_TYPE_LABELS: Record<string, string> = {
  electricity: 'Electricity',
  water: 'Water',
  internet: 'Internet',
  rent: 'Rent',
  other: 'Other',
  maintenance: 'Maintenance',
}

const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash',  label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'maya',  label: 'Maya' },
]

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB

// ── Schema ────────────────────────────────────────────────────────────────────

const payBillSchema = z.object({
  paid_at: z.string().min(1, 'Date required'),
  payment_method: z.string(),
})

type PayBillSchema = z.infer<typeof payBillSchema>

// ── Props ─────────────────────────────────────────────────────────────────────

interface PayBillModalProps {
  bill: Bill | null
  isOpen: boolean
  onClose: () => void
  onPay: (billId: string, paidDate: string) => Promise<void>
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PayBillModal({ bill, isOpen, onClose, onPay }: PayBillModalProps) {
  const { toast } = useToast()
  const todayPH = formatInTimeZone(new Date(), PH_TZ, 'yyyy-MM-dd')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PayBillSchema>({
    resolver: zodResolver(payBillSchema),
    defaultValues: { paid_at: todayPH, payment_method: '' },
  })

  const paidAt = watch('paid_at')

  useEffect(() => {
    if (!isOpen) return
    setSelectedFile(null)
    reset({ paid_at: formatInTimeZone(new Date(), PH_TZ, 'yyyy-MM-dd'), payment_method: '' })
  }, [isOpen, reset])

  const onSubmit = handleSubmit(async (values) => {
    if (!bill) return
    try {
      await onPay(bill.id, values.paid_at)
      toast({ title: 'Bill marked as paid' })
      onClose()
    } catch (e) {
      toast({
        title: 'Payment failed',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    }
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  }

  const clearFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const selectCls =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  if (!bill) return null

  const billLabel = BILL_TYPE_LABELS[bill.bill_type] ?? bill.bill_type

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Payment" size="sm">
      <form onSubmit={onSubmit} className="space-y-4">

        {/* ── Summary card ─────────────────────────────────────────────── */}
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{billLabel}</p>
            <p className="text-sm font-bold">{formatCurrency(bill.amount)}</p>
          </div>
          {bill.description && (
            <p className="text-xs text-muted-foreground">{bill.description}</p>
          )}
        </div>

        {/* ── Payment Date + Method ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="pay-bill-date">
              Payment Date <span className="text-destructive">*</span>
            </Label>
            <Controller
              name="paid_at"
              control={control}
              render={({ field }) => (
                <DatePickerInput
                  id="pay-bill-date"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            {errors.paid_at && (
              <p className="text-xs text-destructive">{errors.paid_at.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-bill-method">Payment Method</Label>
            <Controller
              name="payment_method"
              control={control}
              render={({ field }) => (
                <select
                  id="pay-bill-method"
                  value={field.value}
                  onChange={field.onChange}
                  className={selectCls}
                >
                  <option value="">— Select —</option>
                  {PAYMENT_METHOD_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              )}
            />
          </div>
        </div>

        {/* ── Receipt upload ────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label>Receipt <span className="font-normal text-muted-foreground">(5 MB max)</span></Label>

          {selectedFile ? (
            <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-sm">{selectedFile.name}</span>
              <button
                type="button"
                onClick={clearFile}
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
            onChange={handleFileChange}
          />
        </div>

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Pay'}
          </Button>
        </div>

      </form>
    </Modal>
  )
}

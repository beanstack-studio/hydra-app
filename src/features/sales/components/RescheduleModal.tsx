import { useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, parse, addMinutes } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { Modal } from '@/components/shared/Modal'
import { DatePickerInput } from '@/components/shared/DatePickerInput'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { PH_TZ, generateTimeSlots, formatDate, formatTime } from '@/lib/utils'
import type { Sale } from '../types'

const schema = z.object({
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
})

type FormValues = z.infer<typeof schema>

interface RescheduleModalProps {
  sale:          Sale | null
  isOpen:        boolean
  onClose:       () => void
  onReschedule:  (saleId: string, scheduledAt: string) => Promise<void>
}

function timeToMins(t: string): number {
  const d = parse(t, 'h:mm a', new Date())
  return d.getHours() * 60 + d.getMinutes()
}

const selectClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function RescheduleModal({ sale, isOpen, onClose, onReschedule }: RescheduleModalProps) {
  const { toast } = useToast()

  const nowPH    = toZonedTime(new Date(), PH_TZ)
  const todayStr = format(nowPH, 'yyyy-MM-dd')
  const cutoffPH = addMinutes(nowPH, 30)
  const cutoffMins = cutoffPH.getHours() * 60 + cutoffPH.getMinutes()

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: '', time: '' },
  })

  const selectedDate = watch('date')
  const selectedTime = watch('time')

  // Pre-fill with existing scheduled_at when modal opens
  useEffect(() => {
    if (!isOpen || !sale) return
    if (sale.scheduled_at) {
      const zonedDate = toZonedTime(new Date(sale.scheduled_at), PH_TZ)
      reset({
        date: format(zonedDate, 'yyyy-MM-dd'),
        time: format(zonedDate, 'h:mm a'),
      })
    } else {
      reset({ date: '', time: '' })
    }
  }, [isOpen, sale, reset])

  // When date switches to today, clear time if it's now past the cutoff
  useEffect(() => {
    if (selectedDate === todayStr && selectedTime && timeToMins(selectedTime) <= cutoffMins) {
      setValue('time', '')
    }
  }, [selectedDate, selectedTime, todayStr, cutoffMins, setValue])

  const availableSlots = useMemo(() => {
    const all = generateTimeSlots()
    if (selectedDate === todayStr) return all.filter((s) => timeToMins(s) > cutoffMins)
    return all
  }, [selectedDate, todayStr, cutoffMins])

  const onSubmit = handleSubmit(async (values) => {
    if (!sale) return
    try {
      const naiveDate = parse(`${values.date} ${values.time}`, 'yyyy-MM-dd h:mm a', new Date())
      const utcDate   = fromZonedTime(naiveDate, PH_TZ)
      await onReschedule(sale.id, utcDate.toISOString())
      toast({
        title: 'Order rescheduled',
        description: `${formatDate(utcDate.toISOString())} at ${formatTime(utcDate.toISOString())}`,
      })
      onClose()
    } catch (e) {
      toast({ title: 'Reschedule failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    }
  })

  const orderLabel = sale?.order_type === 'delivery' ? 'Delivery' : 'Pickup'
  const currentSchedule = sale?.scheduled_at
    ? `${formatDate(sale.scheduled_at)} at ${formatTime(sale.scheduled_at)}`
    : null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Reschedule ${orderLabel}`} size="sm">
      <form onSubmit={onSubmit} className="space-y-4">
        {currentSchedule && (
          <p className="text-xs text-muted-foreground">
            Currently scheduled: <span className="font-medium text-foreground">{currentSchedule}</span>
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>New Date</Label>
            <Controller
              name="date"
              control={control}
              render={({ field }) => (
                <DatePickerInput
                  value={field.value}
                  onChange={field.onChange}
                  min={todayStr}
                />
              )}
            />
            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>New Time</Label>
            <Controller
              name="time"
              control={control}
              render={({ field }) => (
                <select
                  value={field.value}
                  onChange={field.onChange}
                  className={selectClass}
                  disabled={!selectedDate}
                >
                  <option value="">— Select —</option>
                  {availableSlots.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}
            />
            {errors.time && <p className="text-xs text-destructive">{errors.time.message}</p>}
          </div>
        </div>

        {selectedDate === todayStr && availableSlots.length === 0 && (
          <p className="text-xs text-destructive">No times available today — must be at least 30 minutes from now.</p>
        )}

        <p className="text-xs text-muted-foreground">
          Times within 30 minutes of now are unavailable for same-day reschedule.
        </p>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Confirm Reschedule'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

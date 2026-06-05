import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { formatInTimeZone } from 'date-fns-tz'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { generateTimeSlots, PH_TZ } from '@/lib/utils'
import { computeHoursWorked } from '../types'
import type { TimeLog, TimeLogInput } from '../types'
import type { StaffMember } from '@/features/settings/hooks/useTeamSettings'

const TIME_SLOTS = generateTimeSlots()

const logSchema = z.object({
  staff_id:  z.string().min(1, 'Select a staff member'),
  log_date:  z.string().min(1, 'Date is required'),
  clock_in:  z.string().min(1, 'Clock-in time is required'),
  clock_out: z.string().nullable(),
  notes:     z.string().nullable(),
})

type LogForm = z.infer<typeof logSchema>

const selectCls =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

interface TimeLogModalProps {
  isOpen: boolean
  onClose: () => void
  log: TimeLog | null
  staff: StaffMember[]
  onAdd: (input: TimeLogInput) => Promise<void>
  onUpdate: (id: string, input: Partial<TimeLogInput>) => Promise<void>
}

export function TimeLogModal({ isOpen, onClose, log, staff, onAdd, onUpdate }: TimeLogModalProps) {
  const { toast } = useToast()
  const todayPH = formatInTimeZone(new Date(), PH_TZ, 'yyyy-MM-dd')

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<LogForm>({
    resolver: zodResolver(logSchema),
    defaultValues: { staff_id: '', log_date: todayPH, clock_in: '8:00 AM', clock_out: null, notes: null },
  })

  useEffect(() => {
    if (!isOpen) return
    if (log) {
      reset({
        staff_id:  log.staff_id,
        log_date:  log.log_date,
        clock_in:  log.clock_in,
        clock_out: log.clock_out ?? null,
        notes:     log.notes ?? null,
      })
    } else {
      reset({ staff_id: '', log_date: todayPH, clock_in: '8:00 AM', clock_out: null, notes: null })
    }
  }, [log, isOpen, reset, todayPH])

  const clockIn  = watch('clock_in')
  const clockOut = watch('clock_out')
  const computedHours = clockIn && clockOut ? computeHoursWorked(clockIn, clockOut) : null

  const onSubmit = handleSubmit(async (values) => {
    try {
      const hours = values.clock_out ? computeHoursWorked(values.clock_in, values.clock_out) : null
      const input: TimeLogInput = {
        staff_id:     values.staff_id,
        log_date:     values.log_date,
        clock_in:     values.clock_in,
        clock_out:    values.clock_out || null,
        hours_worked: hours,
        notes:        values.notes || null,
      }
      if (log) {
        await onUpdate(log.id, input)
        toast({ title: 'Log updated' })
      } else {
        await onAdd(input)
        toast({ title: 'Log added' })
      }
      onClose()
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    }
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={log ? 'Edit Time Log' : 'Add Time Log'} size="sm">
      <form onSubmit={onSubmit} className="space-y-4">

        <div className="space-y-1.5">
          <Label htmlFor="log-staff">Staff Member</Label>
          <select id="log-staff" {...register('staff_id')} className={selectCls}>
            <option value="" disabled>Select staff…</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
          {errors.staff_id && <p className="text-xs text-destructive">{errors.staff_id.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="log-date">Date</Label>
          <Input id="log-date" type="date" {...register('log_date')} />
          {errors.log_date && <p className="text-xs text-destructive">{errors.log_date.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="log-in">Clock In</Label>
            <select id="log-in" {...register('clock_in')} className={selectCls}>
              {TIME_SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {errors.clock_in && <p className="text-xs text-destructive">{errors.clock_in.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="log-out">
              Clock Out <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <select id="log-out" {...register('clock_out')} className={selectCls}>
              <option value="">— not yet —</option>
              {TIME_SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {computedHours !== null && (
          <p className="text-xs text-muted-foreground rounded-md bg-muted/40 px-3 py-2">
            Hours worked: <span className="font-semibold text-foreground">{computedHours.toFixed(2)} hrs</span>
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="log-notes">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Textarea id="log-notes" rows={2} placeholder="e.g. covered for Jessa…" {...register('notes')} />
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : log ? 'Save Changes' : 'Add Log'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

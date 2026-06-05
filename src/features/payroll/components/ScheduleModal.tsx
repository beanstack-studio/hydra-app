import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { generateTimeSlots } from '@/lib/utils'
import type { DayKey } from '@/features/settings/types'
import type { StaffSchedule, StaffScheduleInput } from '../types'

// ── Schema ─────────────────────────────────────────────────────────────────────

const daySchema = z.object({
  is_active:   z.boolean(),
  shift_start: z.string().min(1),
  shift_end:   z.string().min(1),
})

const scheduleSchema = z.object({
  monday:    daySchema,
  tuesday:   daySchema,
  wednesday: daySchema,
  thursday:  daySchema,
  friday:    daySchema,
  saturday:  daySchema,
  sunday:    daySchema,
})

type ScheduleForm = z.infer<typeof scheduleSchema>

// ── Constants ──────────────────────────────────────────────────────────────────

const TIME_SLOTS = generateTimeSlots()
const DAY_ORDER: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS: Record<DayKey, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}
const DEFAULT_SHIFT = { is_active: false, shift_start: '8:00 AM', shift_end: '5:00 PM' }

const selectCls =
  'w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

// ── Props ──────────────────────────────────────────────────────────────────────

interface ScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  staffId: string
  staffName: string
  existingSchedules: StaffSchedule[]
  onSave: (staffId: string, days: StaffScheduleInput[]) => Promise<void>
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ScheduleModal({ isOpen, onClose, staffId, staffName, existingSchedules, onSave }: ScheduleModalProps) {
  const { toast } = useToast()

  const buildDefaults = (): ScheduleForm => {
    const defaults: Partial<ScheduleForm> = {}
    for (const day of DAY_ORDER) {
      const existing = existingSchedules.find((s) => s.day_of_week === day)
      defaults[day] = existing
        ? { is_active: true, shift_start: existing.shift_start, shift_end: existing.shift_end }
        : { ...DEFAULT_SHIFT }
    }
    return defaults as ScheduleForm
  }

  const { register, handleSubmit, control, watch, reset, formState: { isSubmitting } } = useForm<ScheduleForm>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: buildDefaults(),
  })

  useEffect(() => {
    if (isOpen) reset(buildDefaults())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, existingSchedules])

  const watched = watch()

  const onSubmit = handleSubmit(async (values) => {
    try {
      const days: StaffScheduleInput[] = DAY_ORDER.map((day) => ({
        day_of_week: day,
        shift_start: values[day].shift_start,
        shift_end:   values[day].shift_end,
        is_active:   values[day].is_active,
      }))
      await onSave(staffId, days)
      toast({ title: 'Schedule saved' })
      onClose()
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    }
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Schedule — ${staffName}`} size="sm">
      <div className="space-y-3">
        {DAY_ORDER.map((day) => {
          const isActive = watched[day]?.is_active ?? false
          return (
            <div key={day} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{DAY_LABELS[day]}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{isActive ? 'Working' : 'Off'}</span>
                  <Controller
                    name={`${day}.is_active` as const}
                    control={control}
                    render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange} aria-label={`${DAY_LABELS[day]} active`} />
                    )}
                  />
                </div>
              </div>

              {isActive && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Shift Start</p>
                    <select className={selectCls} {...register(`${day}.shift_start` as const)}>
                      {TIME_SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Shift End</p>
                    <select className={selectCls} {...register(`${day}.shift_end` as const)}>
                      {TIME_SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="button" className="flex-1" disabled={isSubmitting} onClick={() => void onSubmit()}>
            {isSubmitting ? 'Saving…' : 'Save Schedule'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { generateTimeSlots } from '@/lib/utils'
import { DEFAULT_OPEN_HOURS as DEFAULTS } from '../types'
import type { StationSettings, StationSettingsInput, DayKey, OpenHours } from '../types'

// ── Schema ────────────────────────────────────────────────────────────────────

const daySchema = z.object({
  open:       z.boolean(),
  open_time:  z.string().min(1),
  close_time: z.string().min(1),
})

const openHoursSchema = z.object({
  monday:    daySchema,
  tuesday:   daySchema,
  wednesday: daySchema,
  thursday:  daySchema,
  friday:    daySchema,
  saturday:  daySchema,
  sunday:    daySchema,
}).refine(
  (data) => {
    const all = generateTimeSlots()
    return (Object.keys(data) as DayKey[]).every((day) => {
      const d = data[day]
      if (!d.open) return true
      return all.indexOf(d.open_time) < all.indexOf(d.close_time)
    })
  },
  { message: 'Open time must be before close time for each open day' }
)

type OpenHoursForm = z.infer<typeof openHoursSchema>

// ── Constants ─────────────────────────────────────────────────────────────────

const TIME_SLOTS = generateTimeSlots()

const DAY_LABELS: Record<DayKey, string> = {
  monday:    'Monday',
  tuesday:   'Tuesday',
  wednesday: 'Wednesday',
  thursday:  'Thursday',
  friday:    'Friday',
  saturday:  'Saturday',
  sunday:    'Sunday',
}

const DAY_ORDER: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const selectCls =
  'w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

// ── Props ─────────────────────────────────────────────────────────────────────

interface OpenHoursSettingsProps {
  stationSettings: StationSettings | null
  onUpdateSettings: (input: Partial<StationSettingsInput>) => Promise<void>
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OpenHoursSettings({ stationSettings, onUpdateSettings }: OpenHoursSettingsProps) {
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)

  const currentHours: OpenHours = stationSettings?.open_hours ?? DEFAULTS

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OpenHoursForm>({
    resolver: zodResolver(openHoursSchema),
    defaultValues: currentHours,
  })

  useEffect(() => {
    reset(stationSettings?.open_hours ?? DEFAULTS)
  }, [stationSettings?.open_hours, reset])

  const watchedDays = watch()

  const onSave = handleSubmit(async (values) => {
    try {
      await onUpdateSettings({ open_hours: values as OpenHours })
      toast({ title: 'Open hours saved' })
      setIsEditing(false)
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    }
  })

  const handleCancel = () => {
    reset(stationSettings?.open_hours ?? DEFAULTS)
    setIsEditing(false)
  }

  // ── View mode ───────────────────────────────────────────────────────────────

  if (!isEditing) {
    return (
      <div className="space-y-3 w-full">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Open Hours</h2>
          <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-card divide-y divide-border">
          {DAY_ORDER.map((day) => {
            const d = currentHours[day]
            return (
              <div key={day} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm font-medium w-28">{DAY_LABELS[day]}</span>
                {d.open ? (
                  <span className="text-sm text-muted-foreground">
                    {d.open_time} – {d.close_time}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wide">Closed</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Edit mode ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Open Hours</h2>
      </div>

      {errors.root && (
        <p className="text-xs text-destructive">{errors.root.message}</p>
      )}

      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {DAY_ORDER.map((day) => {
          const isOpen = watchedDays[day]?.open ?? false
          return (
            <div key={day} className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{DAY_LABELS[day]}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{isOpen ? 'Open' : 'Closed'}</span>
                  <Controller
                    name={`${day}.open` as const}
                    control={control}
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label={`${DAY_LABELS[day]} open`}
                      />
                    )}
                  />
                </div>
              </div>

              {isOpen && (
                <div className="grid grid-cols-2 gap-2 pl-0">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Opens</p>
                    <select className={selectCls} {...register(`${day}.open_time` as const)}>
                      {TIME_SLOTS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Closes</p>
                    <select className={selectCls} {...register(`${day}.close_time` as const)}>
                      {TIME_SLOTS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="button" onClick={() => void onSave()} disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save Hours'}
        </Button>
        <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>
      </div>
    </div>
  )
}

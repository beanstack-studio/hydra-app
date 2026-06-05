import { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { formatInTimeZone } from 'date-fns-tz'
import { Paperclip, X, Camera } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { DatePickerInput } from '@/components/shared/DatePickerInput'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { PH_TZ } from '@/lib/utils'
import type { MaintenanceLog, MaintenanceLogInput } from '../types'

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB

// ── Schema ────────────────────────────────────────────────────────────────────

const maintenanceSchema = z.object({
  equipment:    z.string().min(1, 'Equipment name is required'),
  issue:        z.string().min(1, 'Issue description is required'),
  service_date: z.string().min(1, 'Service date is required'),
  cost:         z.number().nullable(),
  technician:   z.string().nullable(),
})

type MaintenanceSchema = z.infer<typeof maintenanceSchema>

// ── Props ─────────────────────────────────────────────────────────────────────

interface MaintenanceModalProps {
  isOpen: boolean
  onClose: () => void
  log: MaintenanceLog | null
  onAdd: (input: MaintenanceLogInput, photos?: File[]) => Promise<void>
  onUpdate: (id: string, input: Partial<MaintenanceLogInput>, photos?: File[]) => Promise<void>
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MaintenanceModal({ isOpen, onClose, log, onAdd, onUpdate }: MaintenanceModalProps) {
  const { toast } = useToast()
  const todayPH = formatInTimeZone(new Date(), PH_TZ, 'yyyy-MM-dd')

  const photoInputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<File[]>([])

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MaintenanceSchema>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: { equipment: '', issue: '', service_date: todayPH, cost: null, technician: '' },
  })

  useEffect(() => {
    if (!isOpen) return
    setPhotos([])
    if (log) {
      reset({
        equipment:    log.item_filter,
        issue:        log.remarks ?? '',
        service_date: log.service_date ?? log.maintenance_date,
        cost:         log.cost,
        technician:   log.technician ?? '',
      })
    } else {
      reset({ equipment: '', issue: '', service_date: todayPH, cost: null, technician: '' })
    }
  }, [log, isOpen, reset, todayPH])

  const serviceDate = watch('service_date')
  const costValue   = watch('cost')

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const oversized = files.filter((f) => f.size > MAX_FILE_BYTES)
    if (oversized.length > 0) {
      toast({
        title: 'File too large',
        description: `${oversized.length} photo(s) exceed 5 MB and were skipped.`,
        variant: 'destructive',
      })
    }
    const valid = files.filter((f) => f.size <= MAX_FILE_BYTES)
    setPhotos((prev) => [...prev, ...valid])
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      const input: MaintenanceLogInput = {
        equipment:    values.equipment,
        issue:        values.issue,
        service_date: values.service_date,
        cost:         values.cost ?? null,
        technician:   values.technician || null,
        photos_urls:  null,
      }
      if (log) {
        await onUpdate(log.id, input, photos.length > 0 ? photos : undefined)
        toast({ title: 'Log updated' })
      } else {
        await onAdd(input, photos.length > 0 ? photos : undefined)
        toast({ title: 'Log added' })
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={log ? 'Edit Log' : 'Add Maintenance Log'} size="sm">
      <form onSubmit={onSubmit} className="space-y-4">

        {/* ── Equipment ─────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="maint-equip">Equipment <span className="text-destructive">*</span></Label>
          <input
            id="maint-equip"
            placeholder="e.g. Purifier, Compressor"
            {...register('equipment')}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {errors.equipment && <p className="text-xs text-destructive">{errors.equipment.message}</p>}
        </div>

        {/* ── Issue ─────────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="maint-issue">Issue / Work Done <span className="text-destructive">*</span></Label>
          <Textarea id="maint-issue" placeholder="Describe the problem or work done…" rows={2}
            {...register('issue')} />
          {errors.issue && <p className="text-xs text-destructive">{errors.issue.message}</p>}
        </div>

        {/* ── Date + Cost ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="maint-date">Service Date <span className="text-destructive">*</span></Label>
            <DatePickerInput
              id="maint-date"
              value={serviceDate}
              onChange={(v) => setValue('service_date', v, { shouldValidate: true })}
            />
            {errors.service_date && <p className="text-xs text-destructive">{errors.service_date.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maint-cost">Cost</Label>
            <Controller
              name="cost"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  id="maint-cost"
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? null)}
                />
              )}
            />
            {costValue != null && costValue > 0 && (
              <p className="text-xs text-muted-foreground">Added as an unpaid expense in Expenses.</p>
            )}
          </div>
        </div>

        {/* ── Technician ────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="maint-tech">Technician</Label>
          <input
            id="maint-tech"
            placeholder="Name or company"
            {...register('technician')}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        {/* ── Photos ────────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label>Photos</Label>

          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {photos.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs">
                  <Paperclip className="h-3 w-3 text-muted-foreground" />
                  <span className="max-w-[120px] truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="flex items-center gap-2 w-full rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors duration-150"
          >
            <Camera className="h-3.5 w-3.5" />
            <span>Add photos</span>
          </button>

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePhotoSelect}
          />
        </div>

        {/* ── Actions ──────────────────────────────────────────────────── */}
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

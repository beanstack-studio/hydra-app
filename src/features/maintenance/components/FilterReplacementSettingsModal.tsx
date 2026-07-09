import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import type { Supply } from '@/features/supplies/types'

const schema = z.object({
  day: z.coerce
    .number({ invalid_type_error: 'Enter a number' })
    .int('Must be a whole number')
    .min(1, 'Must be between 1 and 31')
    .max(31, 'Must be between 1 and 31'),
})

type FormValues = z.infer<typeof schema>

// Same select style used in SupplyModal auto-deduct section
const selectClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

interface FilterReplacementSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  replacementDay: number
  linkedSupplyId: string | null
  linkedSupplyQty: number
  supplies: Supply[]
  onSave: (day: number, supplyId: string | null, supplyQty: number) => Promise<void>
}

export function FilterReplacementSettingsModal({
  isOpen,
  onClose,
  replacementDay,
  linkedSupplyId,
  linkedSupplyQty,
  supplies,
  onSave,
}: FilterReplacementSettingsModalProps) {
  const { toast } = useToast()

  const [supplyId,  setSupplyId]  = useState('')
  const [supplyQty, setSupplyQty] = useState(1)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { day: replacementDay },
  })

  // Sync form + local state whenever the modal reopens or values change externally
  useEffect(() => {
    if (isOpen) {
      reset({ day: replacementDay })
      setSupplyId(linkedSupplyId ?? '')
      setSupplyQty(linkedSupplyQty)
    }
  }, [isOpen, replacementDay, linkedSupplyId, linkedSupplyQty, reset])

  const onSubmit = async (values: FormValues) => {
    try {
      await onSave(values.day, supplyId || null, supplyQty)
      toast({ title: 'Filter replacement settings saved' })
      onClose()
    } catch (e) {
      toast({
        title: 'Failed to save settings',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Filter Replacement Settings" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Replacement schedule */}
        <div className="space-y-1.5">
          <Label htmlFor="fr-day">Replacement schedule</Label>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Replace filters on day</span>
            <Input
              id="fr-day"
              type="number"
              min={1}
              max={31}
              className="w-20"
              {...register('day')}
            />
            <span className="text-sm text-muted-foreground">of each month</span>
          </div>
          {errors.day && (
            <p className="text-xs text-destructive">{errors.day.message}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            If the chosen day doesn't exist in a given month (e.g. day 31 in
            February), the last valid day of that month is used automatically.
            The setting is never permanently changed — March will still use day 31.
          </p>
        </div>

        {/* Supply deduction — same UI pattern as SupplyModal "Auto-deduct when sold" */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Deduct supply when replaced</Label>
            <span className="text-xs text-muted-foreground">Supply · Qty</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={supplyId}
              onChange={(e) => setSupplyId(e.target.value)}
              className={selectClass}
            >
              <option value="">— None —</option>
              {supplies.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <Input
              type="number"
              min={1}
              step={1}
              value={supplyId ? supplyQty : ''}
              onChange={(e) => setSupplyQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
              disabled={!supplyId}
              placeholder="1"
              className="w-20 shrink-0"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Optional. When set, clicking "Mark as Replaced" automatically deducts
            this quantity from the selected supply's stock.
          </p>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

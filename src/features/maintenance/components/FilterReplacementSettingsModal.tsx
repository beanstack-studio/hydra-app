import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

const schema = z.object({
  day: z.coerce
    .number({ invalid_type_error: 'Enter a number' })
    .int('Must be a whole number')
    .min(1, 'Must be between 1 and 31')
    .max(31, 'Must be between 1 and 31'),
})

type FormValues = z.infer<typeof schema>

interface FilterReplacementSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  replacementDay: number
  onSave: (day: number) => Promise<void>
}

export function FilterReplacementSettingsModal({
  isOpen,
  onClose,
  replacementDay,
  onSave,
}: FilterReplacementSettingsModalProps) {
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { day: replacementDay },
  })

  // Sync form value whenever the modal reopens or replacementDay changes externally
  useEffect(() => {
    if (isOpen) reset({ day: replacementDay })
  }, [isOpen, replacementDay, reset])

  const onSubmit = async (values: FormValues) => {
    try {
      await onSave(values.day)
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

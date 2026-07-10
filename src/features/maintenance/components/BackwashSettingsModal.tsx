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
  threshold: z.coerce
    .number({ invalid_type_error: 'Enter a number' })
    .int('Must be a whole number')
    .min(1, 'Must be at least 1')
    .max(9999, 'Must be 9999 or less'),
})

type FormValues = z.infer<typeof schema>

interface BackwashSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  threshold: number
  onSave: (threshold: number) => Promise<void>
}

export function BackwashSettingsModal({
  isOpen,
  onClose,
  threshold,
  onSave,
}: BackwashSettingsModalProps) {
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { threshold },
  })

  // Sync form value whenever the modal reopens or threshold changes externally
  useEffect(() => {
    if (isOpen) reset({ threshold })
  }, [isOpen, threshold, reset])

  const onSubmit = async (values: FormValues) => {
    try {
      await onSave(values.threshold)
      toast({ title: 'Backwash settings saved' })
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
    <Modal isOpen={isOpen} onClose={onClose} title="Backwash Settings" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="bw-threshold">Backwash interval</Label>
          <div className="flex items-center gap-2">
            <Input
              id="bw-threshold"
              type="number"
              min={1}
              max={9999}
              className="w-24"
              {...register('threshold')}
            />
            <span className="text-sm text-muted-foreground">big-container refills</span>
          </div>
          {errors.threshold && (
            <p className="text-xs text-destructive">{errors.threshold.message}</p>
          )}
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

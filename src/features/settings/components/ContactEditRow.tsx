import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatPhone, cleanPhone, cn } from '@/lib/utils'
import type { ContactDetailInput, ContactType } from '../types'

const CONTACT_TYPES: { value: ContactType; label: string }[] = [
  { value: 'mobile', label: 'Mobile' },
  { value: 'landline', label: 'Landline' },
  { value: 'messenger', label: 'Messenger' },
  { value: 'email', label: 'Email' },
]

const PLACEHOLDERS: Record<ContactType, string> = {
  mobile: '09xx xxx xxxx',
  landline: '033 xxx xxxx',
  messenger: '@username',
  email: 'email@example.com',
}

const contactSchema = z.object({
  type: z.enum(['mobile', 'landline', 'messenger', 'email'] as const),
  value: z.string().min(1, 'Required'),
}).superRefine((data, ctx) => {
  if (data.type === 'email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid email address', path: ['value'] })
    }
  }
  if (data.type === 'mobile') {
    const d = data.value.replace(/\D/g, '')
    if (!d.startsWith('09') || d.length !== 11) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Must be 11 digits starting with 09', path: ['value'] })
    }
  }
  if (data.type === 'landline') {
    const d = data.value.replace(/\D/g, '')
    if (d.length < 7 || d.length > 10) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid landline number', path: ['value'] })
    }
  }
})

type ContactSchema = z.infer<typeof contactSchema>

interface ContactEditRowProps {
  defaultValues?: { type: ContactType; value: string }
  onSave: (input: ContactDetailInput) => Promise<void>
  onCancel: () => void
}

export function ContactEditRow({ defaultValues, onSave, onCancel }: ContactEditRowProps) {
  const {
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactSchema>({
    resolver: zodResolver(contactSchema),
    defaultValues: defaultValues ?? { type: 'mobile', value: '' },
  })

  const contactType = watch('type')
  const isPhone = contactType === 'mobile' || contactType === 'landline'

  // Reset value when type changes so stale phone/email doesn't carry over
  useEffect(() => {
    reset((prev) => ({ ...prev, value: '' }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactType])

  const onSubmit = handleSubmit(async (values) => {
    const storedValue = isPhone ? cleanPhone(values.value) : values.value.trim()
    await onSave({ type: values.type, value: storedValue, label: null })
  })

  return (
    <div className="rounded-lg border border-primary/30 bg-accent/30 px-4 py-3 space-y-3">
      {/* Type selector */}
      <Controller
        name="type"
        control={control}
        render={({ field }) => (
          <div className="flex gap-1.5 flex-wrap">
            {CONTACT_TYPES.map((ct) => (
              <button
                key={ct.value}
                type="button"
                onClick={() => field.onChange(ct.value)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium border transition-all duration-150',
                  field.value === ct.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:bg-accent'
                )}
              >
                {ct.label}
              </button>
            ))}
          </div>
        )}
      />

      {/* Value input + actions */}
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-1">
          <Controller
            name="value"
            control={control}
            render={({ field }) => (
              isPhone ? (
                <Input
                  type="tel"
                  placeholder={PLACEHOLDERS[contactType]}
                  value={formatPhone(field.value ?? '')}
                  onChange={(e) => field.onChange(cleanPhone(e.target.value))}
                  onBlur={field.onBlur}
                  autoFocus
                />
              ) : (
                <Input
                  type={contactType === 'email' ? 'email' : 'text'}
                  placeholder={PLACEHOLDERS[contactType]}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  autoFocus
                />
              )
            )}
          />
          {errors.value && (
            <p className="text-xs text-destructive">{errors.value.message}</p>
          )}
        </div>

        <Button
          type="button"
          size="icon"
          className="h-10 w-10 shrink-0"
          disabled={isSubmitting}
          onClick={() => void onSubmit()}
          aria-label="Save contact"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-10 w-10 shrink-0"
          disabled={isSubmitting}
          onClick={onCancel}
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

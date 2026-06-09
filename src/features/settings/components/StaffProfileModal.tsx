import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/shared/Modal'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/utils'
import type { StaffMember, MemberInput } from '../hooks/useTeamSettings'

// ── Schema ────────────────────────────────────────────────────────────────────

const staffSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  phone:     z.string().optional(),
  email:     z.string().email('Enter a valid email').optional().or(z.literal('')),
  pay_rate:  z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? null : Number(v),
    z.number().min(0).nullable()
  ),
})

type StaffSchema = z.infer<typeof staffSchema>

// ── Props ─────────────────────────────────────────────────────────────────────

interface StaffProfileModalProps {
  isOpen: boolean
  onClose: () => void
  staff: StaffMember | null   // null = adding new member
  onSave: (input: MemberInput) => Promise<void>
  onSendInvite: (email: string, fullName: string) => Promise<void>
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StaffProfileModal({
  isOpen,
  onClose,
  staff,
  onSave,
  onSendInvite,
}: StaffProfileModalProps) {
  const { toast } = useToast()
  const station = useAuthStore((s) => s.station)
  const canInvite = station?.plan === 'pro'

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StaffSchema>({
    resolver: zodResolver(staffSchema),
    defaultValues: { pay_type: 'daily', pay_rate: null },
  })

  const watchedEmail   = watch('email')
  const watchedPayRate = watch('pay_rate')
  const watchedName    = watch('full_name')

  const [inviteSent, setInviteSent] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setInviteSent(false)
      reset({
        full_name: staff?.full_name ?? '',
        phone:     staff?.phone ?? '',
        email:     staff?.email ?? '',
        pay_rate:  staff?.pay_rate ?? null,
      })
    }
  }, [isOpen, staff, reset])

  const onSubmit = handleSubmit(async (values) => {
    try {
      await onSave({
        full_name: values.full_name,
        phone:     values.phone,
        email:     values.email || undefined,
        pay_type:  'daily',
        pay_rate:  values.pay_rate,
      })
      toast({ title: staff ? 'Staff updated' : 'Staff member added' })
      onClose()
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    }
  })

  const handleSendInvite = async () => {
    const email = watchedEmail
    if (!email) return
    try {
      await onSendInvite(email, watchedName)
      setInviteSent(true)
      toast({ title: 'Invite sent', description: `Sign-in link sent to ${email}` })
    } catch (e) {
      toast({
        title: 'Invite failed',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    }
  }

  const rateLabel = watchedPayRate != null && watchedPayRate > 0
    ? `${formatCurrency(watchedPayRate)} / day`
    : null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={staff ? 'Edit Staff Profile' : 'Add Team Member'}
      size="sm"
    >
      <form onSubmit={onSubmit} className="space-y-5">

        {/* ── Basic info ───────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="sp-name">Full Name <span className="text-destructive">*</span></Label>
          <Input
            id="sp-name"
            placeholder="e.g. Maria Santos"
            autoFocus
            {...register('full_name')}
          />
          {errors.full_name && (
            <p className="text-xs text-destructive">{errors.full_name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sp-phone">Phone</Label>
          <PhoneInput name="phone" control={control} id="sp-phone" />
        </div>

        {/* ── Email + Invite ───────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="sp-email">
            Email
          </Label>
          <div className="flex gap-2">
            <Input
              id="sp-email"
              type="email"
              placeholder="staff@example.com"
              className="flex-1 min-w-0"
              {...register('email')}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!watchedEmail || !!errors.email || !canInvite}
              onClick={() => void handleSendInvite()}
              className="shrink-0"
              title={
                !canInvite
                  ? 'Upgrade to Pro to invite staff'
                  : !watchedEmail
                  ? 'Enter an email address first'
                  : errors.email
                  ? 'Fix the email address first'
                  : `Send sign-in link to ${watchedEmail}`
              }
            >
              <Mail className="h-4 w-4 mr-1.5" />
              Invite
            </Button>
          </div>
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
          {inviteSent ? (
            <p className="text-xs font-medium text-primary">Invite sent to {watchedEmail}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {canInvite
                ? 'Sends a sign-in link so this person can log into the app.'
                : 'Pro plan required to invite staff members.'}
            </p>
          )}
        </div>

        {/* ── Pay ─────────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="sp-rate">Daily Rate (₱)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
              ₱
            </span>
            <Input
              id="sp-rate"
              type="number"
              step="0.01"
              min="0"
              className="pl-7"
              placeholder="0.00"
              {...register('pay_rate')}
            />
          </div>
          {rateLabel && (
            <p className="text-xs text-muted-foreground">{rateLabel}</p>
          )}
        </div>

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : staff ? 'Save Changes' : 'Add Member'}
          </Button>
        </div>

      </form>
    </Modal>
  )
}

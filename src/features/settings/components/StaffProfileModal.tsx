import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, ShieldCheck, ShieldX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/shared/Modal'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { useToast } from '@/hooks/use-toast'
import { usePlan } from '@/hooks/usePlan'
import { formatCurrency } from '@/lib/utils'
import type { StaffMember, MemberInput } from '../hooks/useTeamSettings'

// ── Schema ────────────────────────────────────────────────────────────────────

const staffSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  phone:     z.string().optional(),
  email:     z.string().email('Enter a valid email').optional().or(z.literal('')),
  pay_rate:  z.number().min(0).nullable(),
})

type StaffSchema = z.infer<typeof staffSchema>

// ── Props ─────────────────────────────────────────────────────────────────────

interface StaffProfileModalProps {
  isOpen: boolean
  onClose: () => void
  staff: StaffMember | null   // null = adding new member
  onSave: (input: MemberInput) => Promise<void>
  onSendInvite: (email: string, fullName: string) => Promise<void>
  onRevokeAccess: (staffId: string) => Promise<void>
  activeEmails: Set<string>
  pendingInviteEmails: Set<string>
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StaffProfileModal({
  isOpen,
  onClose,
  staff,
  onSave,
  onSendInvite,
  onRevokeAccess,
  activeEmails,
  pendingInviteEmails,
}: StaffProfileModalProps) {
  const { toast } = useToast()
  const plan = usePlan()
  const canInvite = plan !== 'free'

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StaffSchema>({
    resolver: zodResolver(staffSchema),
    defaultValues: { pay_rate: null },
  })

  const watchedEmail   = watch('email')
  const watchedPayRate = watch('pay_rate')
  const watchedName    = watch('full_name')

  // hasAccess: staff has accepted the invite and has an active login.
  // hasPendingInvite: invite was sent but not yet accepted — derived from real
  //   server data (pendingInviteEmails from useTeamSettings), so it's consistent
  //   across any device/session, not just the one that triggered the send.
  const hasAccess        = !!staff?.email && activeEmails.has(staff.email.toLowerCase())
  const hasPendingInvite = !hasAccess && !!staff?.email && pendingInviteEmails.has(staff.email.toLowerCase())

  const [isSendingInvite,   setIsSendingInvite]   = useState(false)
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false)
  const [isRevoking,        setIsRevoking]        = useState(false)

  useEffect(() => {
    if (isOpen) {
      setShowRevokeConfirm(false)
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
      // Email is immutable when staff has active login — admin can't change it
      const emailToSave = hasAccess
        ? (staff?.email ?? undefined)
        : (values.email || undefined)

      await onSave({
        full_name: values.full_name,
        phone:     values.phone,
        email:     emailToSave,
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
    setIsSendingInvite(true)
    try {
      await onSendInvite(email, watchedName)
      // No local inviteSent flag needed — onSendInvite calls fetchAll() which
      // updates pendingInviteEmails in the hook, driving hasPendingInvite here.
      toast({ title: 'Invite sent', description: `Invitation link sent to ${email}` })
    } catch (e) {
      toast({
        title: 'Invite failed',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    } finally {
      setIsSendingInvite(false)
    }
  }

  const handleRevoke = async () => {
    if (!staff) return
    setIsRevoking(true)
    try {
      await onRevokeAccess(staff.id)
      setShowRevokeConfirm(false)
      toast({ title: 'Access revoked', description: `${staff.full_name} can no longer sign in.` })
      // Modal stays open — UI transitions to State A so owner can re-invite if needed
    } catch (e) {
      toast({
        title: 'Revoke failed',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    } finally {
      setIsRevoking(false)
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

        {/* ── Name ──────────────────────────────────────────────────────── */}
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

        {/* ── Phone ─────────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="sp-phone">Phone</Label>
          <PhoneInput name="phone" control={control} id="sp-phone" />
        </div>

        {/* ── Daily Rate ────────────────────────────────────────────────── */}
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
              {...register('pay_rate', {
                setValueAs: (v: string) => v === '' || v == null ? null : parseFloat(v),
              })}
            />
          </div>
          {rateLabel && (
            <p className="text-xs text-muted-foreground">{rateLabel}</p>
          )}
        </div>

        {/* ── State B: has login access ──────────────────────────────────── */}
        {hasAccess ? (
          <div className="space-y-3 rounded-lg border border-border p-3 bg-muted/20">

            {/* Email — read-only, not part of form submission */}
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={staff?.email ?? ''}
                disabled
                className="opacity-60"
              />
              <p className="text-[11px] text-muted-foreground">
                Email can only be changed by the staff member from their own account.
              </p>
            </div>

            {/* Access section */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Access
              </p>
              {showRevokeConfirm ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Remove <span className="font-semibold text-foreground">{staff?.full_name}</span>'s
                    login access? Their roster record and payroll history will be kept.
                  </p>
                  <div className="flex flex-col gap-2 lg:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full lg:flex-1"
                      disabled={isRevoking}
                      onClick={() => setShowRevokeConfirm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full lg:flex-1 border-amber-500/50 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/30"
                      disabled={isRevoking}
                      onClick={() => void handleRevoke()}
                    >
                      {isRevoking ? 'Revoking…' : 'Yes, revoke access'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                    <ShieldCheck className="h-4 w-4" />
                    Has access
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-amber-500/50 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/30"
                    onClick={() => setShowRevokeConfirm(true)}
                  >
                    <ShieldX className="h-4 w-4 mr-1.5" />
                    Revoke Access
                  </Button>
                </div>
              )}
            </div>

          </div>
        ) : (
          /* ── State A: no login yet ──────────────────────────────────────── */
          <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/20">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Invite Email{' '}
              <span className="normal-case font-normal text-muted-foreground/60">(optional)</span>
            </p>
            <div className="flex gap-2">
              <Input
                id="sp-email"
                type="email"
                placeholder="staff@example.com"
                className="flex-1 min-w-0"
                disabled={hasPendingInvite}
                {...register('email')}
              />
              {hasPendingInvite ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={isSendingInvite || !canInvite}
                  onClick={() => void handleSendInvite()}
                >
                  <Mail className="h-4 w-4 mr-1.5" />
                  Resend
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={!watchedEmail || !!errors.email || !canInvite || isSendingInvite}
                  title={
                    !canInvite          ? 'Upgrade to Pro to invite staff'
                    : !watchedEmail     ? 'Enter an email address first'
                    : errors.email      ? 'Fix the email address first'
                    : `Send invite to ${watchedEmail}`
                  }
                  onClick={() => void handleSendInvite()}
                >
                  <Mail className="h-4 w-4 mr-1.5" />
                  {isSendingInvite ? 'Sending…' : 'Send Invite'}
                </Button>
              )}
            </div>
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
            {hasPendingInvite ? (
              <p className="text-xs font-medium text-primary">
                Invite sent — link emailed to {watchedEmail ?? staff?.email}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {canInvite
                  ? 'Sends an invitation so this person can set a password and log in.'
                  : 'Pro plan required to invite staff members.'}
              </p>
            )}
          </div>
        )}

        {/* ── Actions ───────────────────────────────────────────────────── */}
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

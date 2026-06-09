import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Lock, Pencil, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/stores/authStore'
import { useAccount } from '../hooks/useAccount'

const nameSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(80),
})

const emailSchema = z.object({
  email: z.string().email('Enter a valid email'),
})

const passwordSchema = z.object({
  password: z.string()
    .min(8, 'At least 8 characters')
    .regex(/\d/, 'Must include at least one number'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: "Passwords don't match",
  path: ['confirm'],
})

type NameValues     = z.infer<typeof nameSchema>
type EmailValues    = z.infer<typeof emailSchema>
type PasswordValues = z.infer<typeof passwordSchema>

export function AccountSettings() {
  const { toast } = useToast()
  const { updateName, updateEmail, updatePassword } = useAccount()

  const user     = useAuthStore((s) => s.user)
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? ''
  const email    = user?.email ?? ''
  const initials = fullName
    ? fullName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : email.slice(0, 2).toUpperCase()

  const [editingName,     setEditingName]     = useState(false)
  const [editingEmail,    setEditingEmail]    = useState(false)
  const [editingPassword, setEditingPassword] = useState(false)
  const [showNewPw,       setShowNewPw]       = useState(false)
  const [showConfirmPw,   setShowConfirmPw]   = useState(false)

  const nameForm = useForm<NameValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { full_name: fullName },
  })

  const emailForm = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  })

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirm: '' },
  })

  const onSaveName = nameForm.handleSubmit(async ({ full_name }) => {
    try {
      await updateName(full_name)
      toast({ title: 'Display name updated' })
      setEditingName(false)
    } catch (e) {
      toast({ title: 'Failed to update name', description: e instanceof Error ? e.message : 'Something went wrong', variant: 'destructive' })
    }
  })

  const onSaveEmail = emailForm.handleSubmit(async ({ email: newEmail }) => {
    try {
      await updateEmail(newEmail)
      toast({ title: 'Confirmation sent', description: `Check ${newEmail} to confirm the change.` })
      emailForm.reset()
      setEditingEmail(false)
    } catch (e) {
      toast({ title: 'Failed to update email', description: e instanceof Error ? e.message : 'Something went wrong', variant: 'destructive' })
    }
  })

  const onSavePassword = passwordForm.handleSubmit(async ({ password }) => {
    try {
      await updatePassword(password)
      toast({ title: 'Password updated' })
      passwordForm.reset()
      setEditingPassword(false)
    } catch (e) {
      toast({ title: 'Failed to update password', description: e instanceof Error ? e.message : 'Something went wrong', variant: 'destructive' })
    }
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

      {/* ── Profile ─────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Profile</h2>
          {!editingName && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { nameForm.reset({ full_name: fullName }); setEditingName(true) }}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-primary">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <form onSubmit={onSaveName} className="space-y-3">
                  <div>
                    <Label htmlFor="full_name" className="text-xs">Display name</Label>
                    <Input
                      id="full_name"
                      {...nameForm.register('full_name')}
                      className="mt-1"
                      autoFocus
                    />
                    {nameForm.formState.errors.full_name && (
                      <p className="text-xs text-destructive mt-1">{nameForm.formState.errors.full_name.message}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={nameForm.formState.isSubmitting}>Save</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditingName(false)}>Cancel</Button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground">{fullName || '—'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{email}</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Security ────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Security</h2>

        {/* Change email */}
        <div className="rounded-lg border border-border bg-card px-4 py-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-sm font-medium text-foreground">Email address</p>
            </div>
            {!editingEmail && (
              <Button size="sm" variant="ghost" onClick={() => { emailForm.reset({ email: '' }); setEditingEmail(true) }}>
                Change
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground pl-6">{email}</p>
          {editingEmail && (
            <form onSubmit={onSaveEmail} className="space-y-3 pt-1">
              <div>
                <Label htmlFor="new_email" className="text-xs">New email</Label>
                <Input
                  id="new_email"
                  type="email"
                  placeholder={email}
                  {...emailForm.register('email')}
                  className="mt-1"
                  autoFocus
                />
                {emailForm.formState.errors.email && (
                  <p className="text-xs text-destructive mt-1">{emailForm.formState.errors.email.message}</p>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                A confirmation link will be sent to the new address. The change takes effect after you confirm.
              </p>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={emailForm.formState.isSubmitting}>Send confirmation</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditingEmail(false)}>Cancel</Button>
              </div>
            </form>
          )}
        </div>

        {/* Change password */}
        <div className="rounded-lg border border-border bg-card px-4 py-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-sm font-medium text-foreground">Password</p>
            </div>
            {!editingPassword && (
              <Button size="sm" variant="ghost" onClick={() => { passwordForm.reset(); setEditingPassword(true) }}>
                Change
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground pl-6 tracking-widest">••••••••</p>
          {editingPassword && (
            <form onSubmit={onSavePassword} className="space-y-3 pt-1">
              <div>
                <Label htmlFor="new_password" className="text-xs">New password</Label>
                <div className="relative mt-1">
                  <Input
                    id="new_password"
                    type={showNewPw ? 'text' : 'password'}
                    {...passwordForm.register('password')}
                    className="pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150"
                    onClick={() => setShowNewPw((v) => !v)}
                  >
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordForm.formState.errors.password
                  ? <p className="text-xs text-destructive mt-1">{passwordForm.formState.errors.password.message}</p>
                  : <p className="text-[11px] text-muted-foreground mt-1">8+ characters · at least one number</p>
                }
              </div>
              <div>
                <Label htmlFor="confirm_password" className="text-xs">Confirm password</Label>
                <div className="relative mt-1">
                  <Input
                    id="confirm_password"
                    type={showConfirmPw ? 'text' : 'password'}
                    {...passwordForm.register('confirm')}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150"
                    onClick={() => setShowConfirmPw((v) => !v)}
                  >
                    {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordForm.formState.errors.confirm && (
                  <p className="text-xs text-destructive mt-1">{passwordForm.formState.errors.confirm.message}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={passwordForm.formState.isSubmitting}>Update password</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditingPassword(false)}>Cancel</Button>
              </div>
            </form>
          )}
        </div>
      </div>

    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

const schema = z.object({
  password: z.string()
    .min(8, 'At least 8 characters')
    .regex(/\d/, 'Must include at least one number'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type Schema = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Schema>({ resolver: zodResolver(schema) })

  // Wait for Supabase to process the recovery token from the URL hash.
  // PASSWORD_RECOVERY fires once the access_token is exchanged — only then
  // is the session valid for calling updateUser().
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const onSubmit = handleSubmit(async (data) => {
    setAuthError(null)
    const { error } = await supabase.auth.updateUser({ password: data.password })
    if (error) { setAuthError(error.message); return }
    navigate('/sales', { replace: true })
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm">

        <div className="flex flex-col items-center gap-3 mb-6">
          <img
            src="/logo.png"
            alt="Hydra"
            className="h-16 w-16 rounded-full object-cover shadow-md ring-2 ring-primary/20"
          />
          <p className="text-xl font-bold text-foreground tracking-tight">Hydra</p>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm p-6">
          {!ready ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Verifying reset link…</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Set a new password</p>
                <p className="text-xs text-muted-foreground">Choose a strong password for your account.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rp-pw">New Password</Label>
                <div className="relative">
                  <Input
                    id="rp-pw"
                    type={showPw ? 'text' : 'password'}
                    placeholder="8+ characters"
                    autoFocus
                    className="pr-10"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150"
                    onClick={() => setShowPw((v) => !v)}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password
                  ? <p className="text-xs text-destructive">{errors.password.message}</p>
                  : <p className="text-[11px] text-muted-foreground">8+ characters · at least one number</p>
                }
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rp-pw2">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="rp-pw2"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repeat password"
                    className="pr-10"
                    {...register('confirmPassword')}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150"
                    onClick={() => setShowConfirm((v) => !v)}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
                )}
              </div>

              {authError && <p className="text-sm text-destructive">{authError}</p>}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Updating…' : 'Update Password'}
              </Button>
            </form>
          )}
        </div>

      </div>
    </div>
  )
}

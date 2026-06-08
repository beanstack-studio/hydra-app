import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

type AuthView = 'login' | 'signup' | 'forgot' | 'recover'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const signUpSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const forgotSchema = z.object({
  email: z.string().email('Enter a valid email'),
})

const recoverSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Please confirm your password'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type LoginSchema   = z.infer<typeof loginSchema>
type SignUpSchema  = z.infer<typeof signUpSchema>
type ForgotSchema  = z.infer<typeof forgotSchema>
type RecoverSchema = z.infer<typeof recoverSchema>

export default function LoginPage() {
  const isPasswordRecovery = useAuthStore((s) => s.isPasswordRecovery)
  const noStation          = useAuthStore((s) => s.noStation)
  const clearAuth          = useAuthStore((s) => s.clearAuth)
  const [view, setView]    = useState<AuthView>('login')
  const [authError,      setAuthError]      = useState<string | null>(null)
  const [signUpSuccess,  setSignUpSuccess]  = useState(false)
  const [forgotSuccess,  setForgotSuccess]  = useState(false)

  useEffect(() => {
    if (isPasswordRecovery) setView('recover')
  }, [isPasswordRecovery])

  const {
    register: regLogin,
    handleSubmit: hsLogin,
    formState: { errors: loginErrors, isSubmitting: loginSubmitting },
  } = useForm<LoginSchema>({ resolver: zodResolver(loginSchema) })

  const {
    register: regSignUp,
    handleSubmit: hsSignUp,
    formState: { errors: signUpErrors, isSubmitting: signUpSubmitting },
  } = useForm<SignUpSchema>({ resolver: zodResolver(signUpSchema) })

  const {
    register: regForgot,
    handleSubmit: hsForgot,
    formState: { errors: forgotErrors, isSubmitting: forgotSubmitting },
  } = useForm<ForgotSchema>({ resolver: zodResolver(forgotSchema) })

  const {
    register: regRecover,
    handleSubmit: hsRecover,
    formState: { errors: recoverErrors, isSubmitting: recoverSubmitting },
  } = useForm<RecoverSchema>({ resolver: zodResolver(recoverSchema) })

  const onLogin = hsLogin(async (data) => {
    setAuthError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password })
    if (error) setAuthError(error.message)
  })

  const onSignUp = hsSignUp(async (data) => {
    setAuthError(null)
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { full_name: data.name } },
    })
    if (error) {
      setAuthError(error.message)
    } else {
      setSignUpSuccess(true)
    }
  })

  const onForgot = hsForgot(async (data) => {
    setAuthError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: window.location.origin,
    })
    if (error) {
      setAuthError(error.message)
    } else {
      setForgotSuccess(true)
    }
  })

  const onRecover = hsRecover(async (data) => {
    setAuthError(null)
    const { error } = await supabase.auth.updateUser({ password: data.password })
    if (error) setAuthError(error.message)
  })

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    clearAuth()
  }

  const switchTab = (v: 'login' | 'signup') => {
    setView(v)
    setAuthError(null)
    setSignUpSuccess(false)
    setForgotSuccess(false)
  }

  const tabClass = (t: 'login' | 'signup') =>
    cn(
      'flex-1 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all duration-150',
      view === t
        ? 'border-primary text-primary'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    )

  const showTabs = view === 'login' || view === 'signup'

  /* Branding header — shared by all views */
  const BrandHeader = () => (
    <div className="flex flex-col items-center gap-3 mb-6">
      <img
        src="/logo.png"
        alt="Hydra"
        className="h-16 w-16 rounded-full object-cover shadow-md ring-2 ring-primary/20"
      />
      <div className="text-center">
        <p className="text-xl font-bold text-foreground tracking-tight">Hydra</p>
        <p className="text-xs text-muted-foreground">Water Station Management</p>
      </div>
    </div>
  )

  if (noStation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-6">
          <BrandHeader />
          <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-4 text-center">
            <p className="text-sm font-semibold text-foreground">Account not linked to a station</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your account was created but has no station assigned yet. Ask your administrator to run the station setup SQL for your account, then try signing in again.
            </p>
            <Button variant="outline" className="w-full" onClick={() => { void handleSignOut() }}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm">
        <BrandHeader />

        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          {showTabs && (
            <div className="flex border-b border-border px-2 pt-2">
              <button type="button" className={tabClass('login')} onClick={() => switchTab('login')}>
                Sign In
              </button>
              <button type="button" className={tabClass('signup')} onClick={() => switchTab('signup')}>
                Sign Up
              </button>
            </div>
          )}

          <div className="p-6">
            {/* ── Sign In ──────────────────────────────────────────────── */}
            {view === 'login' && (
              <form onSubmit={onLogin} noValidate className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" placeholder="you@example.com" autoComplete="email" {...regLogin('email')} />
                  {loginErrors.email && <p className="text-xs text-destructive">{loginErrors.email.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-pw">Password</Label>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-primary transition-colors duration-150"
                      onClick={() => { setView('forgot'); setAuthError(null) }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input id="login-pw" type="password" placeholder="••••••••" autoComplete="current-password" {...regLogin('password')} />
                  {loginErrors.password && <p className="text-xs text-destructive">{loginErrors.password.message}</p>}
                </div>
                {authError && <p className="text-sm text-destructive">{authError}</p>}
                <Button type="submit" className="w-full" disabled={loginSubmitting}>
                  {loginSubmitting ? 'Signing in…' : 'Sign In'}
                </Button>
              </form>
            )}

            {/* ── Sign Up ──────────────────────────────────────────────── */}
            {view === 'signup' && (
              signUpSuccess ? (
                <div className="text-center space-y-3 py-4">
                  <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary text-xl">✓</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">Account created!</p>
                  <p className="text-xs text-muted-foreground">
                    Check your email for a confirmation link, then sign in.
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => switchTab('login')}>
                    Back to Sign In
                  </Button>
                </div>
              ) : (
                <form onSubmit={onSignUp} noValidate className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    For station owners only. Staff receive an email invite from their owner.
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-name">Your Name</Label>
                    <Input id="su-name" placeholder="Full name" {...regSignUp('name')} />
                    {signUpErrors.name && <p className="text-xs text-destructive">{signUpErrors.name.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-email">Email</Label>
                    <Input id="su-email" type="email" placeholder="you@example.com" {...regSignUp('email')} />
                    {signUpErrors.email && <p className="text-xs text-destructive">{signUpErrors.email.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-pw">Password</Label>
                    <Input id="su-pw" type="password" placeholder="6+ characters" {...regSignUp('password')} />
                    {signUpErrors.password && <p className="text-xs text-destructive">{signUpErrors.password.message}</p>}
                  </div>
                  {authError && <p className="text-sm text-destructive">{authError}</p>}
                  <Button type="submit" className="w-full" disabled={signUpSubmitting}>
                    {signUpSubmitting ? 'Creating account…' : 'Create Account'}
                  </Button>
                </form>
              )
            )}

            {/* ── Forgot Password ──────────────────────────────────────── */}
            {view === 'forgot' && (
              forgotSuccess ? (
                <div className="space-y-4">
                  <div className="text-center space-y-2 py-2">
                    <p className="text-sm font-semibold text-foreground">Check your email</p>
                    <p className="text-xs text-muted-foreground">
                      We sent a password reset link. Click it to set a new password.
                    </p>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => { setView('login'); setForgotSuccess(false) }}>
                    Back to Sign In
                  </Button>
                </div>
              ) : (
                <form onSubmit={onForgot} noValidate className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">Reset your password</p>
                    <p className="text-xs text-muted-foreground">Enter your email and we'll send you a reset link.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email">Email</Label>
                    <Input id="forgot-email" type="email" placeholder="you@example.com" autoFocus {...regForgot('email')} />
                    {forgotErrors.email && <p className="text-xs text-destructive">{forgotErrors.email.message}</p>}
                  </div>
                  {authError && <p className="text-sm text-destructive">{authError}</p>}
                  <Button type="submit" className="w-full" disabled={forgotSubmitting}>
                    {forgotSubmitting ? 'Sending…' : 'Send Reset Link'}
                  </Button>
                  <button
                    type="button"
                    className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
                    onClick={() => { setView('login'); setAuthError(null) }}
                  >
                    Back to Sign In
                  </button>
                </form>
              )
            )}

            {/* ── Set New Password ─────────────────────────────────────── */}
            {view === 'recover' && (
              <form onSubmit={onRecover} noValidate className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-foreground mb-1">Set a new password</p>
                  <p className="text-xs text-muted-foreground">Choose a strong password for your account.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rec-pw">New Password</Label>
                  <Input id="rec-pw" type="password" placeholder="6+ characters" autoFocus {...regRecover('password')} />
                  {recoverErrors.password && <p className="text-xs text-destructive">{recoverErrors.password.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rec-pw2">Confirm Password</Label>
                  <Input id="rec-pw2" type="password" placeholder="Repeat password" {...regRecover('confirmPassword')} />
                  {recoverErrors.confirmPassword && <p className="text-xs text-destructive">{recoverErrors.confirmPassword.message}</p>}
                </div>
                {authError && <p className="text-sm text-destructive">{authError}</p>}
                <Button type="submit" className="w-full" disabled={recoverSubmitting}>
                  {recoverSubmitting ? 'Saving…' : 'Set Password'}
                </Button>
              </form>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Hydra · Water Station Management
        </p>
      </div>
    </div>
  )
}

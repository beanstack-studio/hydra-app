import { Check, X, Mail, Zap, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/authStore'
import { usePlan } from '@/hooks/usePlan'
import { cn } from '@/lib/utils'

const UPGRADE_EMAIL = 'hello@beanstack.studio'

const FREE_FEATURES = [
  'Sales recording',
  'Expense tracking',
]

const PRO_FEATURES = [
  'Everything in Free',
  'Customers module',
  'Inventory management',
  'Reports & charts',
  'Delivery reminders',
  'Maintenance log',
  'Unlimited staff accounts',
  'Priority support',
]

function FeatureItem({ label, included }: { label: string; included: boolean }) {
  return (
    <li className="flex items-start gap-2">
      {included
        ? <Check className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
        : <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground/35 mt-0.5" />
      }
      <span className={cn('text-xs leading-relaxed', included ? 'text-foreground' : 'text-muted-foreground/50')}>
        {label}
      </span>
    </li>
  )
}

export function PlanSettings() {
  const station     = useAuthStore((s) => s.station)
  const rawPlan     = usePlan()
  // Treat legacy 'basic' as 'pro' — Basic tier no longer exists
  const currentPlan: 'free' | 'pro' = rawPlan === 'free' ? 'free' : 'pro'
  const stationName = station?.name ?? '—'
  const isPro       = currentPlan === 'pro'

  return (
    <div className="w-full max-w-xl space-y-5">

      {/* Current plan banner */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Zap className="h-[18px] w-[18px] text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">Current plan</p>
          <p className="text-sm font-bold text-foreground">
            {isPro ? 'Pro' : 'Free'} — {stationName}
          </p>
        </div>
        <Badge variant={isPro ? 'default' : 'outline'} className="shrink-0">
          {isPro ? 'Pro' : 'Free'}
        </Badge>
      </div>

      {/* Two-plan comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* Free card */}
        <div className={cn(
          'rounded-xl border bg-card px-4 py-4 space-y-3 flex flex-col',
          !isPro ? 'border-primary/30 ring-1 ring-primary/20' : 'border-border'
        )}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-bold text-foreground">Free</p>
              {!isPro && (
                <span className="text-[9px] font-bold bg-primary/15 text-primary rounded px-1.5 py-0.5">
                  YOUR PLAN
                </span>
              )}
            </div>
            <p className="text-xl font-bold text-foreground">₱0<span className="text-xs font-normal text-muted-foreground">/month</span></p>
            <p className="text-xs text-muted-foreground mt-0.5">1 owner · no staff</p>
          </div>
          <ul className="space-y-1.5 flex-1">
            {FREE_FEATURES.map((f) => (
              <FeatureItem key={f} label={f} included />
            ))}
            {PRO_FEATURES.filter((f) => f !== 'Everything in Free').map((f) => (
              <FeatureItem key={f} label={f} included={false} />
            ))}
          </ul>
        </div>

        {/* Pro card */}
        <div className={cn(
          'rounded-xl border bg-card px-4 py-4 space-y-3 flex flex-col relative overflow-hidden',
          isPro ? 'border-primary/30 ring-1 ring-primary/20' : 'border-primary/20 bg-primary/3'
        )}>
          {/* Popular ribbon */}
          <div className="absolute top-3 right-3">
            <span className="flex items-center gap-0.5 text-[9px] font-bold bg-primary text-primary-foreground rounded-full px-2 py-0.5">
              <Star className="h-2.5 w-2.5" />POPULAR
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-bold text-primary">Pro</p>
              {isPro && (
                <span className="text-[9px] font-bold bg-primary/15 text-primary rounded px-1.5 py-0.5">
                  YOUR PLAN
                </span>
              )}
            </div>
            <p className="text-xl font-bold text-foreground">₱599<span className="text-xs font-normal text-muted-foreground">/month</span></p>
            <p className="text-xs text-muted-foreground mt-0.5">Unlimited staff accounts</p>
          </div>
          <ul className="space-y-1.5 flex-1">
            {PRO_FEATURES.map((f) => (
              <FeatureItem key={f} label={f} included />
            ))}
          </ul>
          {!isPro && (
            <Button
              size="sm"
              className="w-full mt-1"
              onClick={() => {
                window.location.href = `mailto:${UPGRADE_EMAIL}?subject=Upgrade%20to%20Pro%20—%20${encodeURIComponent(stationName)}`
              }}
            >
              Upgrade to Pro
            </Button>
          )}
        </div>
      </div>

      {/* Upgrade instructions */}
      {!isPro && (
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-4 space-y-2">
          <p className="text-sm font-semibold text-foreground">How to upgrade</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Send us an email and we'll activate your Pro plan within the day — no credit cards or sign-ups required.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
            <a
              href={`mailto:${UPGRADE_EMAIL}?subject=Upgrade%20to%20Pro%20—%20${encodeURIComponent(stationName)}`}
              className="text-sm font-medium text-primary hover:underline underline-offset-2 transition-colors duration-150"
            >
              {UPGRADE_EMAIL}
            </a>
          </div>
        </div>
      )}

      {isPro && (
        <p className="text-xs text-muted-foreground text-center">
          You're on the Pro plan — thank you for supporting Hydra!{' '}
          Questions? <a href={`mailto:${UPGRADE_EMAIL}`} className="text-primary hover:underline">{UPGRADE_EMAIL}</a>
        </p>
      )}
    </div>
  )
}

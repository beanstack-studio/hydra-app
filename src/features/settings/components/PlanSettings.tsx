import { Check, X, Mail, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/authStore'
import { usePlan } from '@/hooks/usePlan'
import { cn } from '@/lib/utils'

type Plan = 'free' | 'basic' | 'pro'

interface FeatureRow {
  label: string
  free: boolean | string
  basic: boolean | string
  pro: boolean | string
}

const FEATURES: FeatureRow[] = [
  { label: 'Sales recording',        free: true,        basic: true,       pro: true },
  { label: 'Expense tracking',       free: true,        basic: true,       pro: true },
  { label: 'Customers module',       free: false,       basic: true,       pro: true },
  { label: 'Inventory module',       free: false,       basic: true,       pro: true },
  { label: 'Reports & charts',       free: false,       basic: true,       pro: true },
  { label: 'Delivery reminders',     free: false,       basic: true,       pro: true },
  { label: 'Maintenance log',        free: false,       basic: true,       pro: true },
  { label: 'Staff accounts',         free: false,       basic: 'Up to 3',  pro: 'Unlimited' },
  { label: 'Priority support',       free: false,       basic: false,      pro: true },
]

const UPGRADE_EMAIL = 'hello@beanstack.studio'

function FeatureValue({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-xs font-semibold text-foreground">{value}</span>
  }
  if (value) {
    return <Check className="h-4 w-4 text-primary mx-auto" />
  }
  return <X className="h-3.5 w-3.5 text-muted-foreground/40 mx-auto" />
}

export function PlanSettings() {
  const station     = useAuthStore((s) => s.station)
  const currentPlan = usePlan() as Plan

  const stationName = station?.name ?? '—'

  const PLAN_ORDER: Plan[] = ['free', 'basic', 'pro']

  const PLAN_META: Record<Plan, { label: string; price: string; users: string; color: string }> = {
    free:  { label: 'Free',  price: '₱0',   users: '1 owner',   color: 'text-muted-foreground' },
    basic: { label: 'Basic', price: '₱299', users: 'Up to 3',   color: 'text-foreground' },
    pro:   { label: 'Pro',   price: '₱599', users: 'Unlimited', color: 'text-primary' },
  }

  const isOnFreeOrBasic = currentPlan !== 'pro'

  return (
    <div className="w-full max-w-2xl space-y-6">

      {/* Current plan banner */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Zap className="h-[18px] w-[18px] text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">Current plan</p>
          <p className="text-sm font-bold text-foreground">{PLAN_META[currentPlan].label} — {stationName}</p>
        </div>
        <Badge variant={currentPlan === 'pro' ? 'default' : currentPlan === 'basic' ? 'secondary' : 'outline'} className="shrink-0">
          {PLAN_META[currentPlan].label}
        </Badge>
      </div>

      {/* Plan comparison table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-4 border-b border-border">
          <div className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Features
          </div>
          {PLAN_ORDER.map((p) => {
            const meta = PLAN_META[p]
            const isCurrent = p === currentPlan
            return (
              <div key={p} className={cn(
                'px-3 py-3 text-center border-l border-border',
                isCurrent && 'bg-primary/5'
              )}>
                <p className={cn('text-sm font-bold', meta.color)}>{meta.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="font-semibold text-foreground">{meta.price}</span>/mo
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{meta.users}</p>
                {isCurrent && (
                  <span className="inline-block mt-1 text-[9px] font-bold bg-primary/15 text-primary rounded px-1.5 py-0.5">
                    YOUR PLAN
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Feature rows */}
        {FEATURES.map((row, i) => (
          <div
            key={row.label}
            className={cn(
              'grid grid-cols-4 border-b border-border last:border-0',
              i % 2 === 0 ? 'bg-background' : 'bg-muted/20'
            )}
          >
            <div className="px-4 py-2.5 text-xs text-muted-foreground">{row.label}</div>
            {PLAN_ORDER.map((p) => (
              <div key={p} className={cn(
                'px-3 py-2.5 text-center border-l border-border flex items-center justify-center',
                p === currentPlan && 'bg-primary/5'
              )}>
                <FeatureValue value={row[p]} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Upgrade CTA */}
      {isOnFreeOrBasic && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Ready to unlock more?</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Upgrading is quick and easy. Send us a message and we'll get your plan sorted within the day.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary shrink-0" />
            <a
              href={`mailto:${UPGRADE_EMAIL}?subject=Upgrade%20Plan%20—%20${encodeURIComponent(stationName)}`}
              className="text-sm font-medium text-primary hover:underline underline-offset-2 transition-colors duration-150"
            >
              {UPGRADE_EMAIL}
            </a>
          </div>
          <Button
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => {
              window.location.href = `mailto:${UPGRADE_EMAIL}?subject=Upgrade%20Plan%20—%20${encodeURIComponent(stationName)}`
            }}
          >
            Email to Upgrade
          </Button>
        </div>
      )}

      {currentPlan === 'pro' && (
        <p className="text-xs text-muted-foreground text-center">
          You're on the Pro plan — thanks for supporting Hydra! Questions?{' '}
          <a href={`mailto:${UPGRADE_EMAIL}`} className="text-primary hover:underline">{UPGRADE_EMAIL}</a>
        </p>
      )}
    </div>
  )
}

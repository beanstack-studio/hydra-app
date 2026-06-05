import { Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/authStore'

type Plan = 'free' | 'basic' | 'pro'

interface PlanInfo {
  label: string
  price: string
  users: string
  features: string[]
}

const PLANS: Record<Plan, PlanInfo> = {
  free: {
    label: 'Free',
    price: '₱0 / month',
    users: '1 owner',
    features: ['Sales recording', 'Expenses tracking'],
  },
  basic: {
    label: 'Basic',
    price: '₱299 / month',
    users: 'Up to 3',
    features: ['All Free features', 'All modules', 'Delivery reminders', 'Staff invites'],
  },
  pro: {
    label: 'Pro',
    price: '₱599 / month',
    users: 'Unlimited',
    features: ['All Basic features', 'Priority support', 'Unlimited staff invites'],
  },
}

const PLAN_BADGE_VARIANT: Record<Plan, 'default' | 'secondary' | 'outline'> = {
  free: 'outline',
  basic: 'secondary',
  pro: 'default',
}

export function PlanSettings() {
  const station = useAuthStore((s) => s.station)
  const currentPlan = (station?.plan ?? 'free') as Plan
  const info = PLANS[currentPlan]

  return (
    <div className="w-full max-w-xl space-y-6">
      {/* Current plan card */}
      <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current Plan</p>
            <p className="text-xl font-bold mt-0.5">{info.label}</p>
          </div>
          <Badge variant={PLAN_BADGE_VARIANT[currentPlan]} className="text-sm px-3 py-1">
            {info.label}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground">Price</p>
            <p className="font-semibold">{info.price}</p>
          </div>
          <div className="rounded-lg bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground">Users</p>
            <p className="font-semibold">{info.users}</p>
          </div>
        </div>

        <ul className="space-y-1.5">
          {info.features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Upgrade note */}
      {currentPlan !== 'pro' && (
        <div className="rounded-xl border border-border bg-muted/30 px-5 py-4 space-y-1">
          <p className="text-sm font-semibold">Want to upgrade?</p>
          <p className="text-sm text-muted-foreground">
            Contact <span className="font-medium text-foreground">Beanstalk Studio</span> to change your subscription plan.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Station: <span className="font-medium text-foreground">{station?.name ?? '—'}</span>
      </p>
    </div>
  )
}

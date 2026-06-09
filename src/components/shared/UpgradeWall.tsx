import { Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'

interface UpgradeWallProps {
  title: string
  feature: string
}

export function UpgradeWall({ title, feature }: UpgradeWallProps) {
  const navigate = useNavigate()
  return (
    <div>
      <PageHeader title={title} />
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-muted/40 px-6 py-12 text-center">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {feature} is not available on the Free plan
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Upgrade to Basic or Pro to unlock {feature.toLowerCase()} and all premium features.
          </p>
        </div>
        <Button size="sm" onClick={() => navigate('/settings?section=plan')}>
          View Plans
        </Button>
      </div>
    </div>
  )
}

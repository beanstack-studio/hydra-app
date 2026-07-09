import { useNavigate } from 'react-router-dom'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BackwashAlertModalProps {
  combinedCount: number
  slimCount: number
  roundCount: number
  onDismiss: () => void
}

export function BackwashAlertModal({
  combinedCount,
  slimCount,
  roundCount,
  onDismiss,
}: BackwashAlertModalProps) {
  const navigate = useNavigate()

  const handleGoToMaintenance = () => {
    navigate('/settings?section=maintenance')
    onDismiss()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onDismiss} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <span className="text-sm font-semibold text-foreground">Backwash Overdue</span>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-3">
          <p className="text-sm text-foreground">
            Your filter has processed{' '}
            <span className="font-bold text-red-600 dark:text-red-400">
              {combinedCount.toLocaleString()} refills
            </span>{' '}
            since the last backwash. Backwash the filter soon to maintain water quality.
          </p>
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            {slimCount.toLocaleString()} Slim · {roundCount.toLocaleString()} Round
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 pb-4">
          <Button variant="outline" size="sm" className="flex-1" onClick={onDismiss}>
            Dismiss
          </Button>
          <Button size="sm" className="flex-1" onClick={handleGoToMaintenance}>
            Go to Maintenance
          </Button>
        </div>

      </div>
    </div>
  )
}

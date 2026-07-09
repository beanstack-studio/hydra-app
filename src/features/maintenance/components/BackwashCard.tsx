import { useState } from 'react'
import { Droplets, CheckCircle2, AlertTriangle, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { useBackwashTracker } from '../hooks/useBackwashTracker'
import { BackwashSettingsModal } from './BackwashSettingsModal'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/stores/authStore'

// Compute 4 evenly-spaced tick labels for the progress bar.
// For threshold=300 → [0, 100, 200, 300].
// For threshold=400 → [0, 133, 267, 400].
function computeBarTicks(threshold: number): number[] {
  const step = Math.round(threshold / 3)
  return [0, step, step * 2, threshold]
}

export function BackwashCard() {
  const { toast } = useToast()
  const role    = useAuthStore((s) => s.role)
  const isOwner = role === 'owner' || role === 'super_admin'

  const {
    combinedCount, slimCount, roundCount,
    slimYtd, roundYtd, backwashYtd,
    threshold,
    zone,
    isLoading,
    error,
    markAsBackwashed,
    updateThreshold,
  } = useBackwashTracker()

  const [isMarking,     setIsMarking]     = useState(false)
  const [settingsOpen,  setSettingsOpen]  = useState(false)

  // Progress bar: 0–100 within the SVG viewBox
  const barPercent = Math.min(100, (combinedCount / threshold) * 100)
  const barTicks   = computeBarTicks(threshold)

  const iconBgClass = {
    green:  'bg-emerald-100 dark:bg-emerald-900/30',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30',
    red:    'bg-red-100 dark:bg-red-900/30',
  }[zone]

  const iconColorClass = {
    green:  'text-emerald-600 dark:text-emerald-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    red:    'text-red-600 dark:text-red-400',
  }[zone]

  const fillClass = {
    green:  'fill-emerald-500',
    yellow: 'fill-yellow-400',
    red:    'fill-red-500',
  }[zone]

  const countColorClass = {
    green:  'text-foreground',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    red:    'text-red-600 dark:text-red-400',
  }[zone]

  const ytdTotal = slimYtd + roundYtd

  const handleBackwash = async () => {
    setIsMarking(true)
    try {
      await markAsBackwashed()
      toast({ title: 'Backwash logged', description: 'Counter reset to 0.' })
    } catch (e) {
      toast({
        title: 'Failed to log backwash',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    } finally {
      setIsMarking(false)
    }
  }

  if (isLoading) return <LoadingSkeleton rows={3} />

  if (error) return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {error}
    </div>
  )

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center shrink-0', iconBgClass)}>
              {zone === 'green'
                ? <Droplets className={cn('h-3.5 w-3.5', iconColorClass)} />
                : <AlertTriangle className={cn('h-3.5 w-3.5', iconColorClass)} />
              }
            </div>
            <p className="text-sm font-semibold text-foreground">Backwash Tracker</p>
          </div>
          {isOwner && (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150"
              aria-label="Backwash settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Progress bar — SVG avoids inline style={{}} */}
        <div className="space-y-1">
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <svg
              viewBox="0 0 100 8"
              className="h-full w-full"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {barPercent > 0 && (
                <rect x="0" y="0" width={barPercent} height="8" className={fillClass} />
              )}
            </svg>
          </div>
          {/* 4 tick labels: 0 / ⅓ / ⅔ / max */}
          <div className="flex justify-between text-[9px] text-muted-foreground px-0.5">
            {barTicks.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>

        {/* Count row + button (side-by-side on md+, stacked on mobile) */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 pt-1">
          <div className="min-w-0">
            <p className={cn('text-xl font-bold leading-tight', countColorClass)}>
              {combinedCount.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground">
                {' '}/ {threshold.toLocaleString()} refills since last backwash
              </span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {slimCount.toLocaleString()} Slim · {roundCount.toLocaleString()} Round
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ytdTotal.toLocaleString()} refills YTD · {backwashYtd} backwash{backwashYtd !== 1 ? 'es' : ''} YTD
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="shrink-0 w-full md:w-auto"
            disabled={isMarking}
            onClick={() => void handleBackwash()}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            {isMarking ? 'Logging…' : 'Mark as Backwashed'}
          </Button>
        </div>

      </div>

      {isOwner && (
        <BackwashSettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          threshold={threshold}
          onSave={updateThreshold}
        />
      )}
    </>
  )
}

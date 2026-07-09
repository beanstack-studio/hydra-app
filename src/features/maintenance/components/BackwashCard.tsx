import { useState } from 'react'
import { Droplets, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { useBackwashTracker } from '../hooks/useBackwashTracker'
import { formatDate, cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

const REFERENCE_COUNT = 300
// Tick labels at even 50-unit intervals across the bar
const BAR_TICKS = [0, 50, 100, 150, 200, 250, 300]

export function BackwashCard() {
  const { toast } = useToast()
  const {
    combinedCount, slimCount, roundCount,
    slimYtd, roundYtd,
    lastBackwashedAt,
    zone,
    isLoading,
    error,
    markAsBackwashed,
  } = useBackwashTracker()

  const [isMarking, setIsMarking] = useState(false)

  // Progress bar: 0–100 within the SVG viewBox
  const barPercent = Math.min(100, (combinedCount / REFERENCE_COUNT) * 100)

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

  const sinceLabel = lastBackwashedAt
    ? `Since ${formatDate(lastBackwashedAt)}`
    : 'Since installation'

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
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">

      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center shrink-0', iconBgClass)}>
          {zone === 'green'
            ? <Droplets className={cn('h-3.5 w-3.5', iconColorClass)} />
            : <AlertTriangle className={cn('h-3.5 w-3.5', iconColorClass)} />
          }
        </div>
        <p className="text-sm font-semibold text-foreground">Backwash Tracker</p>
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
            <rect x="0" y="0" width={barPercent} height="8" className={fillClass} />
          </svg>
        </div>
        {/* Tick labels at even 50-unit spacing */}
        <div className="flex justify-between text-[9px] text-muted-foreground px-0.5">
          {BAR_TICKS.map((t) => (
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
              {' '}/ {REFERENCE_COUNT} refills since last backwash
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {slimCount.toLocaleString()} Slim · {roundCount.toLocaleString()} Round
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ytdTotal.toLocaleString()} total YTD · {sinceLabel}
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
  )
}

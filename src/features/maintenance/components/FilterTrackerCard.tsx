import { useState } from 'react'
import { Droplets, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { useFilterTracker } from '../hooks/useFilterTracker'
import { formatDate, cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

const REFERENCE_COUNT = 300

export function FilterTrackerCard() {
  const { toast } = useToast()
  const {
    combinedCount, slimCount, roundCount,
    slimYtd, roundYtd,
    lastReplacedAt,
    zone,
    isLoading,
    error,
    markAsReplaced,
  } = useFilterTracker()

  const [isMarking, setIsMarking] = useState(false)

  // Progress bar: 0–100 within the viewBox (100 units = REFERENCE_COUNT refills)
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

  const countColorClass = zone === 'green'
    ? 'text-foreground'
    : zone === 'yellow'
      ? 'text-yellow-600 dark:text-yellow-400'
      : 'text-red-600 dark:text-red-400'

  const sinceLabel = lastReplacedAt
    ? `Since ${formatDate(lastReplacedAt)}`
    : 'Since installation'

  const handleReplace = async () => {
    setIsMarking(true)
    try {
      await markAsReplaced()
      toast({ title: 'Filter replacement logged', description: 'Counter reset to 0.' })
    } catch (e) {
      toast({
        title: 'Failed to log replacement',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    } finally {
      setIsMarking(false)
    }
  }

  if (isLoading) return <LoadingSkeleton rows={4} />

  if (error) return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {error}
    </div>
  )

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">

      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', iconBgClass)}>
          {zone === 'green'
            ? <Droplets className={cn('h-4 w-4', iconColorClass)} />
            : <AlertTriangle className={cn('h-4 w-4', iconColorClass)} />
          }
        </div>
        <p className="text-sm font-semibold text-foreground">Filter Replacement Tracker</p>
      </div>

      {/* Progress bar — SVG approach avoids inline style={{}} */}
      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <svg
          viewBox="0 0 100 10"
          className="h-full w-full"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <rect
            x="0"
            y="0"
            width={barPercent}
            height="10"
            className={fillClass}
          />
        </svg>
      </div>

      {/* Zone markers */}
      <div className="flex justify-between text-[10px] text-muted-foreground -mt-3 px-0.5">
        <span>0</span>
        <span className="text-yellow-500 font-medium">200</span>
        <span className="text-orange-500 font-medium">270</span>
        <span className="text-red-500 font-medium">300</span>
      </div>

      {/* Main count */}
      <div>
        <p className={cn('text-2xl font-bold', countColorClass)}>
          {combinedCount.toLocaleString()}
          <span className="text-base font-normal text-muted-foreground">
            {' '}/ {REFERENCE_COUNT} refills
          </span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">since last replacement</p>
      </div>

      {/* Breakdown */}
      <div className="space-y-1 border-t border-border pt-3">
        <p className="text-sm text-muted-foreground">
          {slimCount.toLocaleString()} Slim · {roundCount.toLocaleString()} Round containers since last replacement
        </p>
        <p className="text-sm text-muted-foreground">{sinceLabel}</p>
        <p className="text-sm text-muted-foreground">
          {slimYtd.toLocaleString()} Slim · {roundYtd.toLocaleString()} Round containers YTD
        </p>
      </div>

      {/* Action */}
      <Button
        variant="outline"
        className="w-full"
        disabled={isMarking}
        onClick={() => void handleReplace()}
      >
        <CheckCircle2 className="h-4 w-4 mr-2" />
        {isMarking ? 'Logging replacement…' : 'Mark as Replaced'}
      </Button>

    </div>
  )
}

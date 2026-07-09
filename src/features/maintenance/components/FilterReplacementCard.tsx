import { useState } from 'react'
import { Filter, CheckCircle2, AlertTriangle, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { useFilterReplacement } from '../hooks/useFilterReplacement'
import { FilterReplacementSettingsModal } from './FilterReplacementSettingsModal'
import { formatDate, cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/stores/authStore'

// Compute tick labels for the countdown bar.
// Ticks represent "days remaining" (0 = empty/overdue → cycleDays = full/just replaced).
// Deduplication prevents "0 0 0 1" when cycleDays is very small.
function computeBarTicks(cycleDays: number): number[] {
  const step = Math.max(1, Math.round(cycleDays / 3))
  const t1   = Math.min(step,      cycleDays)
  const t2   = Math.min(step * 2,  cycleDays)
  return [...new Set([0, t1, t2, cycleDays])].sort((a, b) => a - b)
}

export function FilterReplacementCard() {
  const { toast } = useToast()
  const role    = useAuthStore((s) => s.role)
  const isOwner = role === 'owner' || role === 'super_admin'

  const {
    lastReplacedAt,
    daysRemaining,
    cycleDays,
    replacementDay,
    replacementsYtd,
    supplies,
    linkedSupplies,
    zone,
    isLoading,
    error,
    markAsReplaced,
    updateSettings,
  } = useFilterReplacement()

  const [isMarking,    setIsMarking]    = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Countdown bar: full (100%) right after replacement, drains to 0% at due date.
  const barPercent = lastReplacedAt === null
    ? 0
    : Math.max(0, Math.min(100, (daysRemaining / cycleDays) * 100))

  const barTicks = computeBarTicks(cycleDays)

  const iconBgClass = {
    green:  'bg-cyan-100 dark:bg-cyan-900/30',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30',
    red:    'bg-red-100 dark:bg-red-900/30',
  }[zone]

  const iconColorClass = {
    green:  'text-cyan-600 dark:text-cyan-400',
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

  // Split main display line: number (bold/large) + descriptor (small/regular)
  // mainNumber is null when there is no leading numeric value ("Due today", "No replacement recorded")
  const mainNumber: number | null =
    lastReplacedAt !== null && daysRemaining !== 0
      ? daysRemaining > 0 ? daysRemaining : Math.abs(daysRemaining)
      : null

  const mainSuffix: string =
    lastReplacedAt === null ? 'No replacement recorded'
    : daysRemaining > 0    ? ` day${daysRemaining !== 1 ? 's' : ''} until next replacement`
    : daysRemaining === 0  ? 'Due today'
                           : ` day${Math.abs(daysRemaining) !== 1 ? 's' : ''} overdue`

  const lastLabel = lastReplacedAt
    ? `Last replaced: ${formatDate(lastReplacedAt)}`
    : 'Not yet replaced'

  const handleReplace = async () => {
    setIsMarking(true)
    try {
      await markAsReplaced()
      toast({ title: 'Filter replacement logged', description: 'Counter reset.' })
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
                ? <Filter className={cn('h-3.5 w-3.5', iconColorClass)} />
                : <AlertTriangle className={cn('h-3.5 w-3.5', iconColorClass)} />
              }
            </div>
            <p className="text-sm font-semibold text-foreground">Filter Replacement</p>
          </div>
          {isOwner && (
            <div className="flex items-center gap-0.5">
              {zone !== 'green' && (
                <span className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold leading-none',
                  zone === 'yellow' ? 'bg-yellow-400 text-yellow-950' : 'bg-red-500 text-white',
                )}>
                  !
                </span>
              )}
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150"
                aria-label="Filter replacement settings"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Countdown progress bar — SVG avoids inline style={{}} */}
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
          {/* Tick labels: days remaining (0 = empty/overdue, cycleDays = full/just replaced) */}
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
              {mainNumber !== null
                ? <>
                    {mainNumber}
                    <span className="text-sm font-normal text-muted-foreground">{mainSuffix}</span>
                  </>
                : mainSuffix
              }
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{lastLabel}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {replacementsYtd} replacement{replacementsYtd !== 1 ? 's' : ''} YTD
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="shrink-0 w-full md:w-auto"
            disabled={isMarking || zone === 'green'}
            title={zone === 'green' ? 'Not due yet' : undefined}
            onClick={() => void handleReplace()}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            {isMarking ? 'Logging…' : 'Mark as Replaced'}
          </Button>
        </div>

      </div>

      {isOwner && (
        <FilterReplacementSettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          replacementDay={replacementDay}
          linkedSupplies={linkedSupplies}
          supplies={supplies}
          onSave={updateSettings}
        />
      )}
    </>
  )
}

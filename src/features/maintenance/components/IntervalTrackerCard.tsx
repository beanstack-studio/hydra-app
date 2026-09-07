import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, CheckCircle2, Settings, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { useToast } from '@/hooks/use-toast'
import { formatDate, cn } from '@/lib/utils'

export type TrackerZone = 'green' | 'yellow' | 'red'

export interface IntervalTrackerCardProps {
  // Display
  title: string
  /** Lucide icon for the green/normal state */
  icon: LucideIcon
  /** Button label: "Mark as Replaced" | "Mark as Tested" */
  actionLabel: string
  /** Singular noun for the count row: "replacement" | "test" */
  countNoun: string
  /** Label prefix for the last-event row: "Last tested" | "Last replaced" */
  lastEventLabel?: string
  /** Toast shown on success */
  successToastTitle: string
  successToastDescription?: string
  // State
  lastEventAt:  string | null
  daysRemaining: number
  cycleDays:    number
  isConfigured: boolean
  eventsTotal:  number
  zone:         TrackerZone
  isLoading:    boolean
  error:        string | null
  // Callbacks
  onMarkCompleted: (notes?: string) => Promise<void>
  onSettingsOpen:  () => void
  onHistoryOpen:   () => void
  // Auth
  isOwner: boolean
}

// Compute tick labels for the countdown bar.
function computeBarTicks(cycleDays: number): number[] {
  const step = Math.max(1, Math.round(cycleDays / 3))
  const t1   = Math.min(step,      cycleDays)
  const t2   = Math.min(step * 2,  cycleDays)
  return [...new Set([0, t1, t2, cycleDays])].sort((a, b) => a - b)
}

export function IntervalTrackerCard({
  title,
  icon: Icon,
  actionLabel,
  countNoun,
  lastEventLabel,
  successToastTitle,
  successToastDescription,
  lastEventAt,
  daysRemaining,
  cycleDays,
  isConfigured,
  eventsTotal,
  zone,
  isLoading,
  error,
  onMarkCompleted,
  onSettingsOpen,
  onHistoryOpen,
  isOwner,
}: IntervalTrackerCardProps) {
  const { toast } = useToast()

  const [isMarking,    setIsMarking]    = useState(false)
  const [noteExpanded, setNoteExpanded] = useState(false)
  const [noteText,     setNoteText]     = useState('')

  if (isLoading) return <LoadingSkeleton rows={3} />

  if (error) return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {error}
    </div>
  )

  // ── Not configured ──────────────────────────────────────────────────────────
  if (!isConfigured) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 bg-muted">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
          </div>
          {isOwner && (
            <button
              type="button"
              onClick={onSettingsOpen}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-all duration-150"
              aria-label={`Set up ${title} tracking`}
            >
              <Settings className="h-3 w-3" />
              Set up
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground py-1">
          Not set up yet — configure in settings to start tracking.
        </p>
      </div>
    )
  }

  // ── Computed display values ─────────────────────────────────────────────────
  const barPercent = lastEventAt === null
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

  const mainNumber: number | null =
    lastEventAt !== null && daysRemaining !== 0
      ? Math.abs(daysRemaining)
      : null

  const mainSuffix: string =
    lastEventAt === null    ? `No ${countNoun} recorded yet`
    : daysRemaining > 0     ? ` day${daysRemaining !== 1 ? 's' : ''} until next ${countNoun}`
    : daysRemaining === 0   ? 'Due today'
                            : ` day${Math.abs(daysRemaining) !== 1 ? 's' : ''} overdue`

  const resolvedLastEventLabel = lastEventLabel ?? `Last ${countNoun}`
  const lastLabel = lastEventAt
    ? `${resolvedLastEventLabel}: ${formatDate(lastEventAt)}`
    : `No ${countNoun} recorded yet`

  const countLabel = `${eventsTotal} ${countNoun}${eventsTotal !== 1 ? 's' : ''} all time`

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleCancelNote = () => {
    setNoteExpanded(false)
    setNoteText('')
  }

  const handleMark = async () => {
    setIsMarking(true)
    try {
      await onMarkCompleted(noteText.trim() || undefined)
      toast({
        title:       successToastTitle,
        description: successToastDescription,
      })
      setNoteExpanded(false)
      setNoteText('')
    } catch (e) {
      toast({
        title:       'Failed to log',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant:     'destructive',
      })
    } finally {
      setIsMarking(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center shrink-0', iconBgClass)}>
            {zone === 'green'
              ? <Icon className={cn('h-3.5 w-3.5', iconColorClass)} />
              : <AlertTriangle className={cn('h-3.5 w-3.5', iconColorClass)} />
            }
          </div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
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
              onClick={onSettingsOpen}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150"
              aria-label={`${title} settings`}
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
        <div className="flex justify-between text-[9px] text-muted-foreground px-0.5">
          {barTicks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>

      {/* Stats + action */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 pt-1">

        {/* Left: stats + history link */}
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
          <p className="text-xs text-muted-foreground mt-0.5">{countLabel}</p>
          <button
            type="button"
            onClick={onHistoryOpen}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors duration-150 mt-1.5"
          >
            <History className="h-3 w-3" />
            View History
          </button>
        </div>

        {/* Right: inline note expand OR action button */}
        {noteExpanded ? (
          <div className="flex flex-col gap-2 md:min-w-[200px]">
            <Input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note (optional)"
              className="text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={isMarking}
                onClick={handleCancelNote}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="flex-1"
                disabled={isMarking}
                onClick={() => void handleMark()}
              >
                {isMarking ? 'Logging…' : 'Log it'}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 w-full md:w-auto"
            disabled={isMarking}
            onClick={() => setNoteExpanded(true)}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  )
}

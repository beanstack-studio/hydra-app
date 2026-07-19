import { useState } from 'react'
import { Droplets, CheckCircle2, AlertTriangle, Settings, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { useBackwashTracker } from '../hooks/useBackwashTracker'
import { BackwashSettingsModal } from './BackwashSettingsModal'
import { BackwashHistoryModal } from './BackwashHistoryModal'
import { formatDate, cn } from '@/lib/utils'
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
    combinedCount,
    lastBackwashedAt,
    backwashYtd,
    threshold,
    alertEnabled,
    zone,
    isLoading,
    isConfigured,
    error,
    markAsBackwashed,
    updateThreshold,
  } = useBackwashTracker()

  const [isMarking,    setIsMarking]    = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen,  setHistoryOpen]  = useState(false)
  const [noteExpanded, setNoteExpanded] = useState(false)
  const [noteText,     setNoteText]     = useState('')

  if (isLoading) return <LoadingSkeleton rows={3} />

  if (error) return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {error}
    </div>
  )

  // ── Not configured ─────────────────────────────────────────────────────────
  if (!isConfigured) {
    return (
      <>
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 bg-muted">
                <Droplets className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">Backwash Tracker</p>
            </div>
            {isOwner && (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-all duration-150"
                aria-label="Set up backwash tracking"
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

        {isOwner && (
          <BackwashSettingsModal
            isOpen={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            threshold={threshold}
            alertEnabled={alertEnabled}
            onSave={updateThreshold}
          />
        )}
      </>
    )
  }

  // ── Configured — normal tracking state ────────────────────────────────────

  const barPercent = Math.min(100, (combinedCount / threshold) * 100)
  const barTicks   = computeBarTicks(threshold)

  const iconBgClass = {
    green:  'bg-teal-100 dark:bg-teal-900/30',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30',
    red:    'bg-red-100 dark:bg-red-900/30',
  }[zone]

  const iconColorClass = {
    green:  'text-teal-600 dark:text-teal-400',
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

  const lastBackwashLabel = lastBackwashedAt
    ? `Last backwash: ${formatDate(lastBackwashedAt)}`
    : 'Not yet backwashed'

  const handleCancelNote = () => {
    setNoteExpanded(false)
    setNoteText('')
  }

  const handleBackwash = async () => {
    setIsMarking(true)
    try {
      await markAsBackwashed(noteText.trim() || undefined)
      toast({ title: 'Backwash logged', description: 'Counter reset to 0.' })
      setNoteExpanded(false)
      setNoteText('')
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
                aria-label="Backwash settings"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            </div>
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
          <div className="flex justify-between text-[9px] text-muted-foreground px-0.5">
            {barTicks.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>

        {/* Count row + action area */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 pt-1">

          {/* Left: stats + history link */}
          <div className="min-w-0">
            <p className={cn('text-xl font-bold leading-tight', countColorClass)}>
              {combinedCount.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground">
                {' '}/ {threshold.toLocaleString()} refills since last backwash
              </span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lastBackwashLabel}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {backwashYtd} backwash{backwashYtd !== 1 ? 'es' : ''} all time
            </p>
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors duration-150 mt-1.5"
            >
              <History className="h-3 w-3" />
              View History
            </button>
          </div>

          {/* Right: inline note expand OR mark button */}
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
                  onClick={() => void handleBackwash()}
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
              Mark as Backwashed
            </Button>
          )}
        </div>

      </div>

      {isOwner && (
        <BackwashSettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          threshold={threshold}
          alertEnabled={alertEnabled}
          onSave={updateThreshold}
        />
      )}

      <BackwashHistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </>
  )
}

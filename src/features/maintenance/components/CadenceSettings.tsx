import { AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { CadenceConfig, ScheduleType, FrequencyCadence } from '../lib/cadenceUtils'

// ── Constants ──────────────────────────────────────────────────────────────────

const SCHEDULE_TYPES: { value: ScheduleType; label: string }[] = [
  { value: 'day_count', label: 'Day Count' },
  { value: 'date',      label: 'Date'      },
  { value: 'weekday',   label: 'Weekday'   },
]

const FREQUENCY_OPTIONS: { value: FrequencyCadence; label: string }[] = [
  { value: 'monthly',   label: 'Monthly'   },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'custom',    label: 'Custom'    },
]

const WEEK_NUMBERS: { value: number; label: string }[] = [
  { value: 1, label: '1st'  },
  { value: 2, label: '2nd'  },
  { value: 3, label: '3rd'  },
  { value: 4, label: '4th'  },
  { value: 5, label: 'Last' },
]

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1)

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

// ── Shared pill styles ────────────────────────────────────────────────────────

const PILL_BASE = 'px-3 py-1.5 text-xs font-medium rounded-md border transition-colors duration-150'
const PILL_ON   = 'bg-primary text-primary-foreground border-primary'
const PILL_OFF  = 'bg-background text-foreground border-border hover:border-primary/50'

// ── Summary sentence helpers ──────────────────────────────────────────────────

function frequencySummary(cfg: CadenceConfig): string {
  if (cfg.frequencyCadence === 'monthly')   return 'every month'
  if (cfg.frequencyCadence === 'quarterly') return 'every 3 months'
  return `every ${cfg.frequencyIntervalMonths} months`
}

function buildSummary(cfg: CadenceConfig): string {
  const freq = frequencySummary(cfg)
  if (cfg.scheduleType === 'date') {
    return `Due on the ${ordinal(cfg.dueDayOfMonth ?? 1)}, ${freq}.`
  }
  if (cfg.scheduleType === 'weekday') {
    const weekLabel = WEEK_NUMBERS.find((w) => w.value === cfg.dueWeekNumber)?.label ?? '1st'
    const dayLabel  = WEEKDAYS.find((d) => d.value === cfg.dueWeekday)?.label ?? 'Mon'
    return `Due the ${weekLabel} ${dayLabel}, ${freq}.`
  }
  return ''
}

// ── Frequency sub-section ─────────────────────────────────────────────────────

function FrequencySection({
  value,
  onChange,
}: {
  value:    CadenceConfig
  onChange: (next: CadenceConfig) => void
}) {
  const set = (patch: Partial<CadenceConfig>) => onChange({ ...value, ...patch })

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Frequency</Label>
      <div className="flex gap-2 flex-wrap">
        {FREQUENCY_OPTIONS.map(({ value: v, label }) => (
          <button
            key={v}
            type="button"
            onClick={() => set({ frequencyCadence: v })}
            className={cn(PILL_BASE, value.frequencyCadence === v ? PILL_ON : PILL_OFF)}
          >
            {label}
          </button>
        ))}
      </div>
      {value.frequencyCadence === 'custom' && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Every</span>
          <Input
            type="number"
            min={2}
            step={1}
            value={value.frequencyIntervalMonths}
            onChange={(e) => set({ frequencyIntervalMonths: Math.max(2, parseInt(e.target.value, 10) || 2) })}
            className="w-20"
          />
          <span className="text-sm text-muted-foreground">months</span>
        </div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface CadenceSettingsProps {
  value:             CadenceConfig
  onChange:          (next: CadenceConfig) => void
  showWearWarning?:  boolean
}

export function CadenceSettings({ value, onChange, showWearWarning = false }: CadenceSettingsProps) {
  const set = (patch: Partial<CadenceConfig>) => onChange({ ...value, ...patch })

  const showWarning = showWearWarning && value.scheduleType !== 'day_count'
  const summary     = buildSummary(value)

  return (
    <div className="space-y-4">

      {/* Schedule type pills */}
      <div className="space-y-2">
        <Label>Schedule type</Label>
        <div className="flex gap-2 flex-wrap">
          {SCHEDULE_TYPES.map(({ value: v, label }) => (
            <button
              key={v}
              type="button"
              onClick={() => set({ scheduleType: v })}
              className={cn(PILL_BASE, value.scheduleType === v ? PILL_ON : PILL_OFF)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Day Count — stays outside the box, simple interval input */}
      {value.scheduleType === 'day_count' && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Every</span>
          <Input
            type="number"
            min={1}
            step={1}
            value={value.intervalDays}
            onChange={(e) => set({ intervalDays: Math.max(1, parseInt(e.target.value, 10) || 1) })}
            className="w-20"
          />
          <span className="text-sm text-muted-foreground">days</span>
        </div>
      )}

      {/* Date / Weekday — grouped bordered box */}
      {(value.scheduleType === 'date' || value.scheduleType === 'weekday') && (
        <div className="space-y-3 rounded-lg border border-border p-3">

          {/* Date — single "On the [15th]" row */}
          {value.scheduleType === 'date' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">On the</span>
              <select
                value={value.dueDayOfMonth}
                onChange={(e) => set({ dueDayOfMonth: parseInt(e.target.value, 10) })}
                className="h-9 w-28 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {DAY_OPTIONS.map((d) => (
                  <option key={d} value={d}>{ordinal(d)}</option>
                ))}
              </select>
              <span className="text-sm text-muted-foreground">of the month</span>
            </div>
          )}

          {/* Weekday — single "On the [1st ▾] [Friday ▾]" combined row */}
          {value.scheduleType === 'weekday' && (
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">On the</span>
              <div className="flex items-start gap-2 flex-wrap">
                {/* Week number pills */}
                <div className="flex gap-1.5 flex-wrap">
                  {WEEK_NUMBERS.map(({ value: v, label }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => set({ dueWeekNumber: v })}
                      className={cn(PILL_BASE, value.dueWeekNumber === v ? PILL_ON : PILL_OFF)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {/* Weekday pills */}
                <div className="flex gap-1.5 flex-wrap">
                  {WEEKDAYS.map(({ value: v, label }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => set({ dueWeekday: v })}
                      className={cn(PILL_BASE, value.dueWeekday === v ? PILL_ON : PILL_OFF)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Frequency — inside the box, below the day-rule control */}
          <FrequencySection value={value} onChange={onChange} />

          {/* Live summary sentence */}
          <p className="text-sm font-medium text-primary">{summary}</p>

          {/* Wear warning — Filter Replacement only, inside the box */}
          {showWarning && (
            <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
              <span>
                Period-based cadence tracks whether this was done at least once this period, not exact days since last replacement.{' '}
                <strong className="font-semibold">Day Count is recommended for equipment wear.</strong>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

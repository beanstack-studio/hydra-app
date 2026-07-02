import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { ReactNode } from 'react'
import { formatCurrency } from '@/lib/utils'

// ── Colors ────────────────────────────────────────────────────────────────────
// 9 distinct named-slice colors (supports up to 9 items shown individually
// when <= 9 total). "Others" always gets the neutral gray below.
const SLICE_COLORS = [
  'hsl(var(--primary))',
  '#10b981',
  '#8b5cf6',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#84cc16',
]
const OTHERS_COLOR = '#6b7280'

const TOP_N = 8 // max individual slices before aggregating into "Others"

// ── Internal types ────────────────────────────────────────────────────────────

interface DonutSlice {
  name: string
  value: number
  othersCount?: number // set only on the aggregated "Others" slice
}

interface TooltipPayloadItem {
  name: string
  value: number
  payload: DonutSlice // recharts passes the full data object here
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function DonutTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const { othersCount } = item.payload
  const label = othersCount != null ? `Others (${othersCount} items)` : item.name
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow text-xs">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-muted-foreground">{formatCurrency(item.value)}</p>
    </div>
  )
}

// ── Public interface ──────────────────────────────────────────────────────────

export interface DonutChartProps {
  data: { name: string; value: number }[]
  /** Grand total — always the sum of ALL items, shown under the chart. */
  total: number
  /** Icon shown in the empty state. */
  emptyIcon: ReactNode
  /** Message shown in the empty state. */
  emptyMessage: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DonutChart({ data, total, emptyIcon, emptyMessage }: DonutChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          {emptyIcon}
          {emptyMessage}
        </p>
      </div>
    )
  }

  // Sort by value descending so the legend always reads largest → smallest.
  const sorted = [...data].sort((a, b) => b.value - a.value)

  // Only aggregate when there are more than TOP_N + 1 items (> 9).
  // With 9 or fewer items every slice gets its own color.
  const slices: DonutSlice[] =
    sorted.length <= TOP_N + 1
      ? sorted
      : [
          ...sorted.slice(0, TOP_N),
          {
            name: 'Others',
            value: sorted.slice(TOP_N).reduce((sum, d) => sum + d.value, 0),
            othersCount: sorted.length - TOP_N,
          },
        ]

  const sliceColor = (entry: DonutSlice, index: number): string =>
    entry.othersCount != null ? OTHERS_COLOR : (SLICE_COLORS[index] ?? OTHERS_COLOR)

  return (
    <>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
          >
            {slices.map((entry, i) => (
              <Cell key={i} fill={sliceColor(entry, i)} />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend — top 8 + "Others" only */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3">
        {slices.map((entry, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: sliceColor(entry, i) }}
            />
            <span className="text-xs text-muted-foreground">{entry.name}</span>
          </div>
        ))}
      </div>

      {/* Grand total — sum of ALL items, not just visible slices */}
      <p className="text-xs text-muted-foreground text-center mt-2">
        Total:{' '}
        <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
      </p>
    </>
  )
}

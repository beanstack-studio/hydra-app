import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { subMonths } from 'date-fns'
import { formatCurrency, PH_TZ, cn } from '@/lib/utils'
import type { Expense } from '../types'

type Period = 'this_month' | 'last_month' | 'this_year'

const PERIOD_LABELS: Record<Period, string> = {
  this_month:  'This Month',
  last_month:  'Last Month',
  this_year:   'This Year',
}

const CATEGORY_LABELS: Record<string, string> = {
  gasoline:    'Gasoline',
  supplies:    'Supplies',
  maintenance: 'Maintenance',
  other:       'Other',
}

// hsl() chart colors that work with the design system
const CATEGORY_FILL: Record<string, string> = {
  gasoline:    'hsl(var(--chart-1, 24 95% 53%))',
  supplies:    'hsl(var(--chart-2, 220 90% 60%))',
  maintenance: 'hsl(var(--chart-3, 270 70% 60%))',
  other:       'hsl(var(--muted-foreground))',
}

interface TooltipPayload {
  value: number
  name: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <p className="text-primary font-semibold">{formatCurrency(payload[0]?.value ?? 0)}</p>
    </div>
  )
}

interface ExpensesSummaryChartProps {
  expenses: Expense[]
}

export function ExpensesSummaryChart({ expenses }: ExpensesSummaryChartProps) {
  const [period, setPeriod] = useState<Period>('this_month')

  const now = toZonedTime(new Date(), PH_TZ)
  const thisMonthStr = formatInTimeZone(now, PH_TZ, 'yyyy-MM')
  const lastMonthStr = formatInTimeZone(subMonths(now, 1), PH_TZ, 'yyyy-MM')
  const thisYearStr  = formatInTimeZone(now, PH_TZ, 'yyyy')

  const filtered = expenses.filter((e) => {
    if (period === 'this_month') return e.expense_date.startsWith(thisMonthStr)
    if (period === 'last_month') return e.expense_date.startsWith(lastMonthStr)
    return e.expense_date.startsWith(thisYearStr)
  })

  const totals: Record<string, number> = { gasoline: 0, supplies: 0, maintenance: 0, other: 0 }
  for (const e of filtered) {
    if (e.category !== 'labor') totals[e.category] = (totals[e.category] ?? 0) + e.amount
  }

  const chartData = Object.entries(totals)
    .filter(([, v]) => v > 0)
    .map(([cat, total]) => ({ category: CATEGORY_LABELS[cat] ?? cat, total, key: cat }))
    .sort((a, b) => b.total - a.total)

  const grandTotal = filtered.reduce((s, e) => e.category !== 'labor' ? s + e.amount : s, 0)

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 mb-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expenses by Category</p>
        <div className="flex rounded-md border border-border overflow-hidden text-xs">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                'px-2.5 py-1 transition-colors duration-150',
                period === p
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No expenses this period</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(chartData.length * 44, 88)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `₱${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              type="category"
              dataKey="category"
              tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
              axisLine={false}
              tickLine={false}
              width={88}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.4)' }} />
            <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={28}>
              {chartData.map((entry) => (
                <Cell key={entry.key} fill={CATEGORY_FILL[entry.key] ?? 'hsl(var(--primary))'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</span>
        <span className="text-sm font-bold text-foreground">{formatCurrency(grandTotal)}</span>
      </div>
    </div>
  )
}

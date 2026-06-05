import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import type { DailyPoint } from '../types'

interface SalesVsExpensesChartProps {
  data: DailyPoint[]
}

interface TooltipPayload {
  value: number
  name: string
  color: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow text-xs space-y-1">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === 'sales' ? 'Sales' : 'Expenses'}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

export function SalesChart({ data }: SalesVsExpensesChartProps) {
  const chartData = data.map((d) => ({
    date: d.date.slice(5),
    sales: d.sales,
    expenses: d.expenses,
  }))

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 rounded-lg border border-border bg-muted/40">
        <p className="text-sm text-muted-foreground">No data for this period</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
        Sales vs Expenses
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} barGap={2} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            width={50}
            tickFormatter={(v: number) => `₱${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value: string) => value === 'sales' ? 'Sales' : 'Expenses'}
          />
          <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
          <Bar dataKey="expenses" fill="#f59e0b" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

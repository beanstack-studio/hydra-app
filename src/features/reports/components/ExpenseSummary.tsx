import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Receipt } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { ExpenseSummaryItem } from '../types'

const CATEGORY_LABELS: Record<string, string> = {
  labor:            'Labor',
  gasoline:         'Gasoline',
  supplies:         'Supplies',
  maintenance:      'Maintenance',
  other:            'Other',
  bill_electricity: 'Electricity',
  bill_water:       'Water Bill',
  bill_internet:    'Internet',
  bill_rent:        'Rent',
  bill_other:       'Other Bills',
  bill_maintenance: 'Maint. Bill',
}

const COLORS = [
  'hsl(var(--primary))',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
]

interface ExpenseSummaryProps {
  data: ExpenseSummaryItem[]
  total: number
}

interface TooltipPayload {
  name: string
  value: number
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow text-xs">
      <p className="font-semibold text-foreground">{item.name}</p>
      <p className="text-muted-foreground">{formatCurrency(item.value)}</p>
    </div>
  )
}

export function ExpenseSummary({ data, total }: ExpenseSummaryProps) {
  const sorted = [...data].sort((a, b) => b.total - a.total)
  const chartData = sorted.map((item) => ({
    name: CATEGORY_LABELS[item.category] ?? item.category,
    value: item.total,
  }))

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
        Expenses by Category
      </p>

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            No expenses this period
          </p>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground text-center mt-1">
            Total: <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
          </p>
        </>
      )}
    </div>
  )
}

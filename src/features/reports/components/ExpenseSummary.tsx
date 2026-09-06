import { Receipt } from 'lucide-react'
import { DonutChart } from '@/components/shared/DonutChart'
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
  bill_bank:        'Bank',
  bill_other:       'Other Bills',
  bill_maintenance: 'Maint. Bill',
}

interface ExpenseSummaryProps {
  data: ExpenseSummaryItem[]
  total: number
}

export function ExpenseSummary({ data, total }: ExpenseSummaryProps) {
  const chartData = [...data]
    .sort((a, b) => b.total - a.total)
    .map((item) => ({
      name: CATEGORY_LABELS[item.category] ?? item.category,
      value: item.total,
    }))

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
        Expenses by Category
      </p>
      <DonutChart
        data={chartData}
        total={total}
        emptyIcon={<Receipt className="h-4 w-4" />}
        emptyMessage="No expenses this period"
      />
    </div>
  )
}

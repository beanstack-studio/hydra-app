import { Users, Receipt, AlertCircle } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import type { CustomerRanking, ExpenseRanking, OutstandingCustomer } from '../types'

interface InsightsSectionProps {
  topCustomers: CustomerRanking[]
  topExpenses: ExpenseRanking[]
  topOutstanding: OutstandingCustomer[]
}

const CATEGORY_LABELS: Record<string, string> = {
  labor:       'Labor',
  gasoline:    'Gasoline',
  supplies:    'Supplies',
  maintenance: 'Maintenance',
  other:       'Other',
}

/**
 * Returns the display label for an expense row.
 * Shows just the item name. If item text and category label are the same
 * (case-insensitive substring match), item is returned as-is to avoid
 * duplication like "Gasoline (Gasoline)".
 */
function expenseLabel(item: string, category: string): string {
  const catLabel = (CATEGORY_LABELS[category] ?? category).toLowerCase()
  const desc = item.toLowerCase()
  if (desc.includes(catLabel) || catLabel.includes(desc)) return item
  return item
}

function RankBadge({ rank }: { rank: number }) {
  const base = 'inline-flex items-center justify-center h-5 w-5 rounded-full text-xs font-bold shrink-0'
  if (rank === 1) return <span className={cn(base, 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400')}>1</span>
  if (rank === 2) return <span className={cn(base, 'bg-muted text-muted-foreground')}>2</span>
  if (rank === 3) return <span className={cn(base, 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400')}>3</span>
  return <span className={cn(base, 'text-muted-foreground text-[10px]')}>{rank}</span>
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-6">
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function InsightCard({ icon, title, subtitle, children }: {
  icon: React.ReactNode
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="text-muted-foreground">{icon}</div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  )
}

export function InsightsSection({ topCustomers, topExpenses, topOutstanding }: InsightsSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

      {/* Top customers */}
      <InsightCard
        icon={<Users className="h-4 w-4" />}
        title="Top Customers"
        subtitle="By total spend this period"
      >
        {topCustomers.length === 0 ? (
          <EmptyRow label="No sales this period" />
        ) : (
          topCustomers.map((c, i) => (
            <div key={c.customer_name} className="flex items-center gap-2">
              <RankBadge rank={i + 1} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{c.customer_name}</p>
                <p className="text-[10px] text-muted-foreground">{c.order_count} order{c.order_count !== 1 ? 's' : ''}</p>
              </div>
              <p className="text-xs font-semibold text-foreground shrink-0">{formatCurrency(c.total_amount)}</p>
            </div>
          ))
        )}
      </InsightCard>

      {/* Top expenses */}
      <InsightCard
        icon={<Receipt className="h-4 w-4" />}
        title="Top Expenses"
        subtitle="By total amount this period"
      >
        {topExpenses.length === 0 ? (
          <EmptyRow label="No expenses this period" />
        ) : (
          topExpenses.map((e, i) => (
            <div key={e.item} className="flex items-center gap-2">
              <RankBadge rank={i + 1} />
              <p className="text-xs font-medium text-foreground flex-1 min-w-0 truncate">
                {expenseLabel(e.item, e.category)}
              </p>
              <p className="text-xs font-semibold text-foreground shrink-0">{formatCurrency(e.total_amount)}</p>
            </div>
          ))
        )}
      </InsightCard>

      {/* Top outstanding balances */}
      <InsightCard
        icon={<AlertCircle className="h-4 w-4" />}
        title="Top Outstanding Balances"
        subtitle="Current unpaid balances — as of today"
      >
        {topOutstanding.length === 0 ? (
          <EmptyRow label="No outstanding balances" />
        ) : (
          topOutstanding.map((o, i) => (
            <div key={o.customer_name} className="flex items-center gap-2">
              <RankBadge rank={i + 1} />
              <p className="text-xs font-medium text-foreground flex-1 min-w-0 truncate">
                {o.customer_name}
              </p>
              <p className="text-xs font-semibold text-destructive shrink-0">{formatCurrency(o.balance_due)}</p>
            </div>
          ))
        )}
      </InsightCard>

    </div>
  )
}

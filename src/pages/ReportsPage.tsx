import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { SalesChart } from '@/features/reports/components/SalesChart'
import { ExpenseSummary } from '@/features/reports/components/ExpenseSummary'
import { SalesByProductChart } from '@/features/reports/components/SalesByProductChart'
import { useReports } from '@/features/reports/hooks/useReports'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, nowPH } from '@/lib/utils'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function ReportsPage() {
  const station = useAuthStore((s) => s.station)
  const canView = station?.plan !== 'free'

  const { data, isLoading, error, month, year, setMonth, setYear } = useReports()

  const currentYear = nowPH().getFullYear()
  const yearOptions = [currentYear - 1, currentYear]

  if (!canView) {
    return (
      <div>
        <PageHeader title="Reports" />
        <div className="rounded-xl border border-border bg-muted/40 px-6 py-8 text-center">
          <p className="text-sm font-semibold text-foreground">Reports require Basic plan or higher</p>
          <p className="mt-1 text-xs text-muted-foreground">Upgrade to unlock monthly reports, charts, and profit tracking.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Reports" />

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {/* Month / Year picker */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatCard label="Total Sales" value={formatCurrency(data?.totalSalesAmount ?? 0)} />
            <StatCard label="Total Expenses" value={formatCurrency(data?.totalExpensesAmount ?? 0)} />
            <StatCard
              label="Net Profit"
              value={formatCurrency(data?.netProfit ?? 0)}
              className={(data?.netProfit ?? 0) >= 0 ? '' : 'border-destructive/30 bg-destructive/5'}
            />
          </div>

          {/* Sales vs Expenses daily chart */}
          <SalesChart data={data?.dailyPoints ?? []} />

          {/* Donut charts side by side on tablet+ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ExpenseSummary
              data={data?.expenseSummary ?? []}
              total={data?.totalExpensesAmount ?? 0}
            />
            <SalesByProductChart
              data={data?.productSales ?? []}
              total={data?.totalSalesAmount ?? 0}
            />
          </div>
        </div>
      )}
    </div>
  )
}

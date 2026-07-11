import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { DatePickerInput } from '@/components/shared/DatePickerInput'
import { SalesChart } from '@/features/reports/components/SalesChart'
import { ExpenseSummary } from '@/features/reports/components/ExpenseSummary'
import { SalesByProductChart } from '@/features/reports/components/SalesByProductChart'
import { InsightsSection } from '@/features/reports/components/InsightsSection'
import { ProductTallySection } from '@/features/reports/components/ProductTallySection'
import { UpgradeWall } from '@/components/shared/UpgradeWall'
import { useReports } from '@/features/reports/hooks/useReports'
import { usePlan } from '@/hooks/usePlan'
import { formatCurrency, formatDate, nowPH, cn, PH_TZ } from '@/lib/utils'
import { formatInTimeZone } from 'date-fns-tz'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const MODE_LABELS: Record<string, string> = {
  daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', ytd: 'YTD',
}

export default function ReportsPage() {
  const plan = usePlan()

  const {
    data, isLoading, error,
    mode, month, year, selectedDate, weekStart, weekEnd,
    setMode, setMonth, setYear, setSelectedDate,
    goToPrevWeek, goToNextWeek,
  } = useReports()

  const now         = nowPH()
  const todayStr    = formatInTimeZone(new Date(), PH_TZ, 'yyyy-MM-dd')
  const currentYear = now.getFullYear()
  const yearOptions = [currentYear - 1, currentYear]

  if (plan === 'free') return <UpgradeWall title="Reports" feature="Reports" />

  return (
    <div>
      <PageHeader title="Reports" />

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {/* Mode toggle + date controls */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {/* Daily / Weekly / Monthly / YTD pill toggle */}
        <div className="flex rounded-md border border-input overflow-hidden text-sm">
          {(['daily', 'weekly', 'monthly', 'ytd'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'px-3 py-1.5 font-medium transition-colors duration-150',
                mode === m
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:text-foreground'
              )}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {/* Daily: single date picker */}
        {mode === 'daily' && (
          <DatePickerInput
            value={selectedDate}
            onChange={setSelectedDate}
            max={todayStr}
          />
        )}

        {/* Weekly: prev / week range / next */}
        {mode === 'weekly' && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goToPrevWeek}
              className="h-8 w-8 flex items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-sm font-medium whitespace-nowrap">
              {formatDate(weekStart + 'T00:00:00')} – {formatDate(weekEnd + 'T00:00:00')}
            </span>
            <button
              type="button"
              onClick={goToNextWeek}
              disabled={weekStart >= todayStr}
              className="h-8 w-8 flex items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:text-foreground transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Monthly: month dropdown */}
        {mode === 'monthly' && (
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        )}

        {/* Year dropdown: monthly + YTD only */}
        {(mode === 'monthly' || mode === 'ytd') && (
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}

      </div>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatCard
              label="Total Sales"
              value={formatCurrency(data?.totalSalesAmount ?? 0)}
              sub={`Outstanding: ${formatCurrency(data?.outstandingAmount ?? 0)}`}
            />
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
              total={(data?.productSales ?? []).reduce((s, p) => s + p.total_amount, 0)}
            />
          </div>

          {/* Per-product unit + revenue tally */}
          <ProductTallySection groups={data?.productTally ?? []} />

          {/* Rankings / Insights */}
          <InsightsSection
            topProducts={data?.topProducts ?? []}
            topCustomers={data?.topCustomers ?? []}
            topSupplies={data?.topSupplies ?? []}
          />
        </div>
      )}
    </div>
  )
}

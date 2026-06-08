import { TrendingUp, Users, Package } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import type { ProductRanking, CustomerRanking, SupplyRanking } from '../types'

interface InsightsSectionProps {
  topProducts: ProductRanking[]
  topCustomers: CustomerRanking[]
  topSupplies: SupplyRanking[]
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

export function InsightsSection({ topProducts, topCustomers, topSupplies }: InsightsSectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

      {/* Best selling products */}
      <InsightCard
        icon={<TrendingUp className="h-4 w-4" />}
        title="Best Selling Products"
        subtitle="By units sold this period"
      >
        {topProducts.length === 0 ? (
          <EmptyRow label="No sales this period" />
        ) : (
          topProducts.map((p, i) => (
            <div key={p.product_name} className="flex items-center gap-2">
              <RankBadge rank={i + 1} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{p.product_name}</p>
                <p className="text-[10px] text-muted-foreground">{p.order_count} order{p.order_count !== 1 ? 's' : ''}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-semibold text-foreground">{p.qty} units</p>
                <p className="text-[10px] text-muted-foreground">{formatCurrency(p.total_amount)}</p>
              </div>
            </div>
          ))
        )}
      </InsightCard>

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

      {/* Most replenished supplies */}
      <InsightCard
        icon={<Package className="h-4 w-4" />}
        title="Most Replenished"
        subtitle="Supplies bought most — depletes fastest"
      >
        {topSupplies.length === 0 ? (
          <EmptyRow label="No supply purchases this period" />
        ) : (
          topSupplies.map((s, i) => (
            <div key={s.item} className="flex items-center gap-2">
              <RankBadge rank={i + 1} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{s.item}</p>
                <p className="text-[10px] text-muted-foreground">{s.purchase_count} purchase{s.purchase_count !== 1 ? 's' : ''}</p>
              </div>
              <p className="text-xs font-semibold text-foreground shrink-0">{formatCurrency(s.total_amount)}</p>
            </div>
          ))
        )}
      </InsightCard>

    </div>
  )
}

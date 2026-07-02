import { ShoppingCart } from 'lucide-react'
import { DonutChart } from '@/components/shared/DonutChart'
import type { ProductSalesSummary } from '../types'

interface SalesByProductChartProps {
  data: ProductSalesSummary[]
  total: number
}

export function SalesByProductChart({ data, total }: SalesByProductChartProps) {
  const chartData = data.map((item) => ({
    name: item.product_name,
    value: item.total_amount,
  }))

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
        Revenue by Product
      </p>
      <DonutChart
        data={chartData}
        total={total}
        emptyIcon={<ShoppingCart className="h-4 w-4" />}
        emptyMessage="No sales this period"
      />
    </div>
  )
}

import { Package } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import type { ProductTallyGroup } from '../types'

interface ProductTallySectionProps {
  groups: ProductTallyGroup[]
}

export function ProductTallySection({ groups }: ProductTallySectionProps) {
  if (groups.length === 0) return null

  const colCount = groups.length

  return (
    <div className="rounded-xl border border-border bg-card p-4">

      {/* Section title */}
      <div className="flex items-center gap-2 mb-4">
        <Package className="h-4 w-4 text-muted-foreground shrink-0" />
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Product Tally
        </h2>
      </div>

      {/* Column headers — mobile only; each group column gets its own headers on desktop */}
      <div className="flex items-center gap-3 mb-1 lg:hidden">
        <span className="flex-1 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide">Product</span>
        <span className="w-14 shrink-0 text-right text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide">Units</span>
        <span className="w-24 shrink-0 text-right text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide">Revenue</span>
      </div>

      {/* Groups: stacked on mobile, side-by-side on desktop */}
      <div className={cn(
        'grid grid-cols-1 lg:divide-x lg:divide-border',
        colCount >= 3 && 'lg:grid-cols-3',
        colCount === 2 && 'lg:grid-cols-2',
      )}>
        {groups.map((group, gi) => (
          <div
            key={group.type}
            className={cn(
              gi > 0 && 'mt-5 lg:mt-0 lg:pl-6',
              gi < groups.length - 1 && 'lg:pr-6',
            )}
          >

            {/* Mobile-only divider between stacked groups */}
            {gi > 0 && (
              <div className="border-t border-border -mx-4 mb-4 lg:hidden" />
            )}

            {/* Group label */}
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
              {group.label}
            </p>

            {/* Column headers — desktop only, repeated per group */}
            <div className="hidden lg:flex items-center gap-2 mb-1">
              <span className="flex-1 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide">Product</span>
              <span className="w-10 shrink-0 text-right text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide">Units</span>
              <span className="w-20 shrink-0 text-right text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide">Revenue</span>
            </div>

            {/* Product rows */}
            <div className="divide-y divide-border/40">
              {group.products.map((row) => (
                <div
                  key={row.product_id}
                  className={cn(
                    'flex items-center gap-3 py-2',
                    row.units === 0 && 'opacity-40',
                  )}
                >
                  <span className="flex-1 min-w-0 text-sm truncate">{row.product_name}</span>
                  <span className="w-14 lg:w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                    {row.units}
                  </span>
                  <span className="w-24 lg:w-20 shrink-0 text-right text-sm tabular-nums">
                    {formatCurrency(row.revenue)}
                  </span>
                </div>
              ))}
            </div>


</div>
        ))}
      </div>

    </div>
  )
}

import { Zap, Droplets, Wifi, Home, ReceiptText } from 'lucide-react'
import type { ReactNode } from 'react'

interface BillType {
  key: string
  label: string
  icon: ReactNode
  description: string
}

const BILL_TYPES: BillType[] = [
  { key: 'electricity', label: 'Electricity', icon: <Zap className="h-5 w-5" />, description: 'Meralco or local co-op bill' },
  { key: 'water', label: 'Water', icon: <Droplets className="h-5 w-5" />, description: 'MCWD, LWUA, or local supply' },
  { key: 'internet', label: 'Internet', icon: <Wifi className="h-5 w-5" />, description: 'ISP monthly subscription' },
  { key: 'rent', label: 'Rent', icon: <Home className="h-5 w-5" />, description: 'Space or equipment rental' },
  { key: 'other', label: 'Other', icon: <ReceiptText className="h-5 w-5" />, description: 'Any other recurring expense' },
]

export function BillTypeSettings() {
  return (
    <div className="space-y-4 max-w-lg">
      <div className="rounded-md border border-border bg-muted/40 px-4 py-3">
        <p className="text-sm font-medium text-foreground">Monthly bill tracking</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Coming in the next update. You'll be able to log monthly bills by category
          and see totals per month.
        </p>
      </div>

      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Built-in categories
      </p>
      <div className="space-y-2">
        {BILL_TYPES.map((type) => (
          <div
            key={type.key}
            className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 select-none"
          >
            <span className="shrink-0 text-muted-foreground">{type.icon}</span>
            <div>
              <p className="text-sm font-medium text-foreground">{type.label}</p>
              <p className="text-xs text-muted-foreground">{type.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

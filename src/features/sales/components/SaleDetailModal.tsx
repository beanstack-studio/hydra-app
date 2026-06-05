import { CalendarClock } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate, formatTime, cn } from '@/lib/utils'
import type { Sale } from '../types'

const ORDER_TYPE_LABEL: Record<string, string> = {
  'walk-in': 'Walk-in',
  delivery: 'Delivery',
  pickup: 'Pickup',
}

interface SaleDetailModalProps {
  sale:         Sale | null
  isOpen:       boolean
  onClose:      () => void
  onReschedule?: () => void
}

export function SaleDetailModal({ sale, isOpen, onClose, onReschedule }: SaleDetailModalProps) {
  if (!sale) return null

  const hasScheduled = !!sale.scheduled_at
  const isScheduledOrder = sale.order_type === 'delivery' || sale.order_type === 'pickup'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sale Details" size="sm">
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Customer</p>
            <p className="font-medium">{sale.customer_name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Date</p>
            <p className="font-medium">{formatDate(sale.sale_date)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Product</p>
            <p className="font-medium">{sale.product_name} ×{sale.qty}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Order Type</p>
            <p className="font-medium">{ORDER_TYPE_LABEL[sale.order_type] ?? sale.order_type}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Payment</p>
            <p className="font-medium capitalize">{sale.payment_mode}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-semibold text-primary">{formatCurrency(sale.total_amount)}</p>
          </div>
          {sale.balance_due > 0 && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Balance Due</p>
              <p className={cn('font-semibold', 'text-destructive')}>{formatCurrency(sale.balance_due)}</p>
            </div>
          )}
        </div>

        {hasScheduled && (
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">Scheduled</p>
            <p className="font-medium">
              {formatDate(sale.scheduled_at!)} at {formatTime(sale.scheduled_at!)}
            </p>
          </div>
        )}

        {sale.delivery_address && (
          <div className={hasScheduled ? '' : 'border-t border-border pt-3'}>
            <p className="text-xs text-muted-foreground">Delivery Address</p>
            <p>{sale.delivery_address}</p>
          </div>
        )}

        {sale.remarks && (
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">Remarks</p>
            <p>{sale.remarks}</p>
          </div>
        )}

        {isScheduledOrder && onReschedule && (
          <div className="border-t border-border pt-3">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => { onClose(); onReschedule() }}
            >
              <CalendarClock className="h-4 w-4" />
              Reschedule {sale.order_type === 'delivery' ? 'Delivery' : 'Pickup'}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

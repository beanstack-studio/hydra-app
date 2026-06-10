import { CalendarClock, CheckCircle2, MapPin, Clock, AlertTriangle, Phone } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate, formatTime, cn } from '@/lib/utils'
import type { Sale } from '../types'

interface SaleDetailModalProps {
  sale:                  Sale | null
  isOpen:                boolean
  onClose:               () => void
  onReschedule?:         () => void
  onConfirmFulfillment?: () => void
  customerPhone?:        string | null
}

export function SaleDetailModal({ sale, isOpen, onClose, onReschedule, onConfirmFulfillment, customerPhone }: SaleDetailModalProps) {
  if (!sale) return null

  const isScheduledOrder = sale.order_type === 'delivery' || sale.order_type === 'pickup'
  const isFulfilled      = !!sale.fulfilled_at
  const orderLabel       = sale.order_type === 'delivery' ? 'Delivery' : 'Pickup'
  const isPaidFully      = sale.balance_due <= 0

  // All items — use items array if present, fallback to single product
  const itemLines: { name: string; qty: number; subtotal: number }[] =
    sale.items && sale.items.length > 0
      ? sale.items.map((i) => ({ name: i.product_name, qty: i.qty, subtotal: i.qty * i.price }))
      : [{ name: sale.product_name, qty: sale.qty, subtotal: sale.product_total }]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sale Details" size="sm">
      <div className="space-y-3 text-sm">

        {/* Section 1: Customer + financials */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Customer</p>
            <p className="font-medium">{sale.customer_name}</p>
            {customerPhone && (
              <a
                href={`tel:${customerPhone}`}
                className="flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
              >
                <Phone className="h-3 w-3" />
                {customerPhone}
              </a>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Date</p>
            <p className="font-medium">{formatDate(sale.sale_date)}</p>
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

        {/* Section 2: Items */}
        <div className="border-t border-border pt-3 space-y-1">
          <p className="text-xs text-muted-foreground mb-1">Items</p>
          {itemLines.map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="font-medium">{item.name} ×{item.qty}</span>
              <span className="text-muted-foreground text-xs">{formatCurrency(item.subtotal)}</span>
            </div>
          ))}
        </div>

        {/* Section 3: Delivery/Pickup details */}
        {isScheduledOrder && (
          <div className="border-t border-border pt-3 space-y-1.5">
            <p className="text-xs font-medium text-foreground">{orderLabel} Details</p>

            {(sale.delivery_address || sale.scheduled_at) && (
              <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                {sale.delivery_address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-px" />
                    {sale.delivery_address}
                  </span>
                )}
                {sale.delivery_address && sale.scheduled_at && (
                  <span className="text-muted-foreground/50">·</span>
                )}
                {sale.scheduled_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 shrink-0 mt-px" />
                    {formatDate(sale.scheduled_at)} {formatTime(sale.scheduled_at)}
                  </span>
                )}
              </div>
            )}

            {isFulfilled && (
              <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 pt-0.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {orderLabel === 'Delivery' ? 'Delivered' : 'Picked up'} on {formatDate(sale.fulfilled_at!)} at {formatTime(sale.fulfilled_at!)}
              </div>
            )}
          </div>
        )}

        {/* Section 4: Remarks */}
        {sale.remarks && (
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">Remarks</p>
            <p>{sale.remarks}</p>
          </div>
        )}

        {/* Section 5: Actions for scheduled orders */}
        {isScheduledOrder && (onReschedule || onConfirmFulfillment) && (
          <div className="border-t border-border pt-3 space-y-2">
            {/* Payment warning — blocks fulfillment confirmation */}
            {onConfirmFulfillment && !isFulfilled && !isPaidFully && (
              <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-px" />
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  Outstanding balance of <span className="font-semibold">{formatCurrency(sale.balance_due)}</span> — collect full payment before confirming {orderLabel.toLowerCase()}.
                </p>
              </div>
            )}
            <div className="flex gap-2">
              {onConfirmFulfillment && !isFulfilled && (
                <Button
                  variant="outline"
                  className="flex-1 gap-2 text-green-600 border-green-200 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-950"
                  disabled={!isPaidFully}
                  onClick={() => { onClose(); onConfirmFulfillment() }}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {orderLabel === 'Delivery' ? 'Mark Delivered' : 'Mark Picked Up'}
                </Button>
              )}
              {onReschedule && (
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  disabled={isFulfilled}
                  onClick={() => { onClose(); onReschedule() }}
                >
                  <CalendarClock className="h-4 w-4" />
                  Reschedule
                </Button>
              )}
            </div>
          </div>
        )}

      </div>
    </Modal>
  )
}

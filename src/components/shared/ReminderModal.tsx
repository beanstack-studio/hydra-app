import { useState } from 'react'
import { Truck, ShoppingBag, X, Clock, MapPin, Phone, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate, formatTime } from '@/lib/utils'
import { dismissReminder, snoozeReminder, fulfillSale } from '@/lib/reminders'
import type { Reminder } from '@/lib/reminders'

interface ReminderModalProps {
  reminders: Reminder[]
  onDismiss: (id: string) => void
}

export function ReminderModal({ reminders, onDismiss }: ReminderModalProps) {
  const [isMarking, setIsMarking] = useState(false)

  if (reminders.length === 0) return null

  const current = reminders[0]
  const remaining = reminders.length - 1

  // Parse: "Type — Name — Items|||phone|||address"
  const [mainPart = '', phone = '', address = ''] = current.message.split('|||')
  const msgParts = mainPart.split(' — ')
  const itemsStr = msgParts.length >= 3 ? msgParts.slice(2).join(' — ') : mainPart
  const itemLines = itemsStr.split(', ').filter(Boolean).slice(0, 6)

  const handleDismiss = async () => {
    await dismissReminder(current.id)
    onDismiss(current.id)
  }

  const handleSnooze = async () => {
    await snoozeReminder(current.id, 5)
    onDismiss(current.id)
  }

  const handleMarkDone = async () => {
    if (!current.sale_id) { await handleDismiss(); return }
    setIsMarking(true)
    try {
      await fulfillSale(current.sale_id)
      onDismiss(current.id)
    } finally {
      setIsMarking(false)
    }
  }

  const Icon  = current.order_type === 'delivery' ? Truck : ShoppingBag
  const label = current.order_type === 'delivery' ? 'Delivery' : 'Pickup'
  const doneLabel = current.order_type === 'delivery' ? 'Mark Delivered' : 'Mark Picked Up'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={handleDismiss} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">{label} Reminder</span>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-base font-semibold text-foreground">{current.customer_name}</p>
            <p className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              {formatDate(current.scheduled_at)} · {formatTime(current.scheduled_at)}
            </p>
          </div>

          {phone && (
            <div className="flex items-center gap-1.5 text-sm text-foreground">
              <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <a href={`tel:${phone}`} className="hover:underline">{phone}</a>
            </div>
          )}

          {address && (
            <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0 mt-px" />
              <span>{address}</span>
            </div>
          )}

          <ul className="space-y-0.5 pt-0.5 border-t border-border/60">
            {itemLines.map((line, i) => (
              <li key={i} className="text-sm text-foreground pt-1">{line}</li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 pb-4">
          <Button variant="outline" size="sm" className="flex-1" onClick={handleSnooze}>
            <Clock className="h-3.5 w-3.5 mr-1" />
            Snooze 5m
          </Button>
          {current.sale_id && (
            <Button
              size="sm"
              className="flex-1 gap-1 text-green-700 border-green-300 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:border-green-800 dark:bg-green-950/40"
              variant="outline"
              disabled={isMarking}
              onClick={handleMarkDone}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isMarking ? '…' : doneLabel}
            </Button>
          )}
        </div>

        {/* Queue indicator */}
        {remaining > 0 && (
          <p className="pb-3 text-center text-xs text-muted-foreground">
            +{remaining} more reminder{remaining > 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  )
}

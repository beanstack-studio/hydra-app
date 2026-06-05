import { Truck, ShoppingBag, X, ExternalLink, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { formatDate, formatTime } from '@/lib/utils'
import { dismissReminder, snoozeReminder } from '@/lib/reminders'
import type { Reminder } from '@/lib/reminders'

interface ReminderModalProps {
  reminders: Reminder[]
  onDismiss: (id: string) => void
}

export function ReminderModal({ reminders, onDismiss }: ReminderModalProps) {
  const navigate = useNavigate()

  if (reminders.length === 0) return null

  const current = reminders[0]
  const remaining = reminders.length - 1

  // Parse items from message: "Delivery — Name — Item1, Item2"
  const msgParts = current.message.split(' — ')
  const itemsStr = msgParts.length >= 3 ? msgParts.slice(2).join(' — ') : current.message
  const itemLines = itemsStr.split(', ').filter(Boolean).slice(0, 5)

  const handleDismiss = async () => {
    await dismissReminder(current.id)
    onDismiss(current.id)
  }

  const handleSnooze = async () => {
    await snoozeReminder(current.id, 5)
    onDismiss(current.id)
  }

  const handleViewSale = async () => {
    await dismissReminder(current.id)
    onDismiss(current.id)
    navigate('/sales')
  }

  const Icon = current.order_type === 'delivery' ? Truck : ShoppingBag
  const label = current.order_type === 'delivery' ? 'Delivery' : 'Pickup'

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
        <div className="px-4 py-4 space-y-2">
          <p className="text-base font-semibold text-foreground">{current.customer_name}</p>
          <p className="text-sm font-semibold text-muted-foreground">
            {formatDate(current.scheduled_at)} · {formatTime(current.scheduled_at)}
          </p>
          <ul className="space-y-0.5 pt-1">
            {itemLines.map((line, i) => (
              <li key={i} className="text-sm text-foreground">
                {line}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 pb-4">
          <Button variant="outline" className="flex-1" onClick={handleDismiss}>
            Dismiss
          </Button>
          <Button variant="outline" className="flex-1 gap-1" onClick={handleSnooze}>
            <Clock className="h-3.5 w-3.5" />
            Snooze 5m
          </Button>
          <Button className="flex-1 gap-1.5" onClick={handleViewSale}>
            <ExternalLink className="h-3.5 w-3.5" />
            View Sale
          </Button>
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

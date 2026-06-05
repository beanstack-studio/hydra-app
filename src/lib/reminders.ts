import { supabase } from './supabase'
import { useAuthStore } from '@/stores/authStore'

export interface Reminder {
  id: string
  station_id: string
  sale_id: string | null
  customer_name: string
  order_type: 'delivery' | 'pickup'
  scheduled_at: string
  message: string
  is_dismissed: boolean
}

let pollingTimer: ReturnType<typeof setInterval> | null = null
let onRemindersCallback: ((reminders: Reminder[]) => void) | null = null

async function checkReminders() {
  const stationId = useAuthStore.getState().stationId
  if (!stationId) return

  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('station_id', stationId)
    .eq('is_dismissed', false)
    .lte('scheduled_at', new Date().toISOString())

  if (error) {
    // Table may not exist yet — stop polling to avoid repeated errors
    stopReminderPolling()
    return
  }

  if (data && data.length > 0 && onRemindersCallback) {
    onRemindersCallback(data as Reminder[])
  }
}

export function startReminderPolling(callback: (reminders: Reminder[]) => void) {
  onRemindersCallback = callback
  void checkReminders()
  pollingTimer = setInterval(() => { void checkReminders() }, 60_000)
}

export function stopReminderPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer)
    pollingTimer = null
  }
  onRemindersCallback = null
}

export async function dismissReminder(id: string) {
  await supabase.from('reminders').update({ is_dismissed: true }).eq('id', id)
}

export async function snoozeReminder(id: string, minutes = 5) {
  const snoozeUntil = new Date(Date.now() + minutes * 60_000).toISOString()
  await supabase.from('reminders').update({ scheduled_at: snoozeUntil }).eq('id', id)
}

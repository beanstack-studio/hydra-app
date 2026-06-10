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
let audioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext | null {
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    return audioCtx
  } catch {
    return null
  }
}

function playReminderAlert() {
  // Vibration — works on Android, silently ignored on iOS
  if ('vibrate' in navigator) {
    navigator.vibrate([300, 100, 300, 100, 400])
  }

  // 5-tone ascending chime via Web Audio API — no audio file needed
  const ctx = getAudioCtx()
  if (!ctx) return

  const resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve()
  void resume.then(() => {
    const playTone = (freq: number, start: number, duration: number, vol = 0.28) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(vol, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
      osc.start(start)
      osc.stop(start + duration)
    }
    const now = ctx.currentTime
    // Ascending 5-note chime: D5 → F#5 → A5 → D6 → A5 (resolve)
    playTone(587,  now,        0.35)
    playTone(740,  now + 0.25, 0.35)
    playTone(880,  now + 0.50, 0.40)
    playTone(1175, now + 0.75, 0.55, 0.32)
    playTone(880,  now + 1.15, 0.70, 0.20)
  })
}

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
    playReminderAlert()
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

export async function fulfillSale(saleId: string) {
  await supabase
    .from('sales')
    .update({ fulfilled_at: new Date().toISOString() })
    .eq('id', saleId)
  await supabase
    .from('reminders')
    .update({ is_dismissed: true })
    .eq('sale_id', saleId)
}

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
    navigator.vibrate([200, 100, 200])
  }

  // Two-tone chime via Web Audio API — no audio file needed
  const ctx = getAudioCtx()
  if (!ctx) return

  const resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve()
  void resume.then(() => {
    const playTone = (freq: number, start: number, duration: number) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.25, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
      osc.start(start)
      osc.stop(start + duration)
    }
    const now = ctx.currentTime
    playTone(880,  now,        0.35)  // A5
    playTone(1108, now + 0.18, 0.45)  // C#6
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

import { useEffect } from 'react'
import { toZonedTime } from 'date-fns-tz'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useBillsBadgeStore } from '@/stores/billsBadgeStore'
import { computeRecurringState } from '../recurringAlerts'
import { PH_TZ } from '@/lib/utils'
import type { Bill } from '../types'

/**
 * Fetches monthly_bills for the current station and derives the Expenses nav
 * badge zone, written into useBillsBadgeStore so Sidebar / BottomNav can read
 * it without a prop-drilling chain.
 *
 * Zone derivation (matches BillTable alert logic exactly):
 *   red    – at least one recurring alert is red
 *   yellow – at least one recurring alert is yellow, OR no bills logged this period
 *   green  – no badge needed
 */
export function useBillsBadge(): void {
  const stationId = useAuthStore((s) => s.stationId)
  const setZone   = useBillsBadgeStore((s) => s.setZone)

  useEffect(() => {
    if (!stationId) return

    let cancelled = false

    const run = async () => {
      const { data } = await supabase
        .from('monthly_bills')
        .select('*')
        .eq('station_id', stationId)

      if (cancelled) return

      const bills = (data ?? []) as Bill[]
      const today = toZonedTime(new Date(), PH_TZ)
      const { alerts, noCurrentPeriodBills } = computeRecurringState(bills, today)

      if (alerts.some((a) => a.urgency === 'red')) {
        setZone('red')
      } else if (alerts.some((a) => a.urgency === 'yellow') || noCurrentPeriodBills) {
        setZone('yellow')
      } else {
        setZone('green')
      }
    }

    void run()
    return () => { cancelled = true }
  }, [stationId, setZone])
}

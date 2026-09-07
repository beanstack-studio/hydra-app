import { useEffect } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useBillsBadgeStore } from '@/stores/billsBadgeStore'
import { PH_TZ } from '@/lib/utils'
import type { BillsBadgeZone } from '@/stores/billsBadgeStore'

/**
 * Derives the Expenses nav badge zone via the get_bills_badge_zone() RPC
 * (runs entirely in Postgres — no PostgREST 1 000-row cap) and writes the
 * result into useBillsBadgeStore so Sidebar / BottomNav / ExpensesPage tab
 * can all read it without prop-drilling.
 *
 * A Realtime subscription on monthly_bills re-fires the RPC on every
 * INSERT / UPDATE / DELETE so the badge updates immediately within the
 * same session when a bill is logged, edited, or paid — no page reload needed.
 */
export function useBillsBadge(): void {
  const stationId = useAuthStore((s) => s.stationId)
  const setZone   = useBillsBadgeStore((s) => s.setZone)

  useEffect(() => {
    if (!stationId) return

    const run = async () => {
      const todayStr = formatInTimeZone(new Date(), PH_TZ, 'yyyy-MM-dd')
      const { data } = await supabase.rpc('get_bills_badge_zone', {
        p_station_id: stationId,
        p_today:      todayStr,
      })
      const zone = data as BillsBadgeZone | null
      if (zone === 'red' || zone === 'yellow' || zone === 'green') {
        setZone(zone)
      }
    }

    void run()

    // Re-derive the badge zone whenever any bill changes in this session.
    // Covers addBill, updateBill, payBill, deleteBill — no page reload needed.
    const channel = supabase
      .channel(`bills-badge-${stationId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'monthly_bills',
          filter: `station_id=eq.${stationId}`,
        },
        () => { void run() },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [stationId, setZone])
}

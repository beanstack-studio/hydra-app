import { useState, useEffect, useCallback } from 'react'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useBackwashStore } from '@/stores/backwashStore'
import { PH_TZ } from '@/lib/utils'
import type { BackwashZone } from '@/stores/backwashStore'

export type { BackwashZone }

// ── Refill detection ─────────────────────────────────────────────────────────

function isSlimRefill(name: string): boolean {
  return /refill.*slim/i.test(name)
}

function isRoundRefill(name: string): boolean {
  return /refill.*round/i.test(name)
}

interface SaleRow {
  product_name: string
  qty: number
  sale_date: string
  items: unknown
}

function countRefillsFromSale(sale: SaleRow): { slim: number; round: number } {
  const items =
    Array.isArray(sale.items) && sale.items.length > 0
      ? (sale.items as Array<{ product_name: string; qty: number }>)
      : [{ product_name: sale.product_name, qty: sale.qty }]

  let slim = 0
  let round = 0
  for (const item of items) {
    if (isSlimRefill(item.product_name)) slim += item.qty
    else if (isRoundRefill(item.product_name)) round += item.qty
  }
  return { slim, round }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface UseBackwashTrackerReturn {
  combinedCount: number
  slimCount: number
  roundCount: number
  slimYtd: number
  roundYtd: number
  lastBackwashedAt: string | null
  zone: BackwashZone
  isLoading: boolean
  error: string | null
  markAsBackwashed: () => Promise<void>
}

export function useBackwashTracker(): UseBackwashTrackerReturn {
  const stationId       = useAuthStore((s) => s.stationId)
  const setCounts       = useBackwashStore((s) => s.setCounts)
  const combinedCount   = useBackwashStore((s) => s.combinedCount)
  const slimCount       = useBackwashStore((s) => s.slimCount)
  const roundCount      = useBackwashStore((s) => s.roundCount)
  const slimYtd         = useBackwashStore((s) => s.slimYtd)
  const roundYtd        = useBackwashStore((s) => s.roundYtd)
  const lastBackwashedAt = useBackwashStore((s) => s.lastBackwashedAt)
  const zone            = useBackwashStore((s) => s.zone)

  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) { setIsLoading(false); return }
    setError(null)
    try {
      // 1. Get the last backwash timestamp
      const { data: logs, error: rErr } = await supabase
        .from('backwash_logs')
        .select('backwashed_at')
        .eq('station_id', stationId)
        .order('backwashed_at', { ascending: false })
        .limit(1)

      if (rErr) throw new Error(rErr.message)

      const lastBackwashedAt =
        (logs?.[0]?.backwashed_at as string | undefined) ?? null

      // Convert to PH date for comparison with sale_date (YYYY-MM-DD)
      // spec: "sale_date > MAX(backwashed_at)" → sales ON the backwash day don't count
      const lastBackwashedDate = lastBackwashedAt
        ? formatInTimeZone(new Date(lastBackwashedAt), PH_TZ, 'yyyy-MM-dd')
        : null

      // 2. Fetch all sales for this station (lean select)
      const { data: sales, error: sErr } = await supabase
        .from('sales')
        .select('product_name, qty, sale_date, items')
        .eq('station_id', stationId)

      if (sErr) throw new Error(sErr.message)

      // 3. YTD start in PH timezone
      const phNow = toZonedTime(new Date(), PH_TZ)
      const ytdStart = `${phNow.getFullYear()}-01-01`

      // 4. Accumulate counts
      let slim = 0, round = 0
      let sYtd = 0, rYtd = 0

      for (const sale of (sales ?? []) as SaleRow[]) {
        const { slim: s, round: r } = countRefillsFromSale(sale)
        const saleDate = sale.sale_date

        // Since last backwash (all-time if never backwashed)
        if (!lastBackwashedDate || saleDate > lastBackwashedDate) {
          slim  += s
          round += r
        }

        // YTD — independent of backwash resets
        if (saleDate >= ytdStart) {
          sYtd += s
          rYtd += r
        }
      }

      setCounts({
        combinedCount:   slim + round,
        slimCount:       slim,
        roundCount:      round,
        slimYtd:         sYtd,
        roundYtd:        rYtd,
        lastBackwashedAt,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load backwash data')
    } finally {
      setIsLoading(false)
    }
  }, [stationId, setCounts])

  useEffect(() => { void fetchData() }, [fetchData])

  const markAsBackwashed = useCallback(async () => {
    if (!stationId) return
    // Use getState() to always capture the latest counts at call time
    const { slimCount, roundCount } = useBackwashStore.getState()

    const { error: e } = await supabase
      .from('backwash_logs')
      .insert({
        station_id:              stationId,
        backwashed_at:           new Date().toISOString(),
        slim_count_at_backwash:  slimCount,
        round_count_at_backwash: roundCount,
      })

    if (e) throw new Error(e.message)
    await fetchData()
  }, [stationId, fetchData])

  return {
    combinedCount,
    slimCount,
    roundCount,
    slimYtd,
    roundYtd,
    lastBackwashedAt,
    zone,
    isLoading,
    error,
    markAsBackwashed,
  }
}

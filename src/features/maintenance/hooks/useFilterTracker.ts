import { useState, useEffect, useCallback } from 'react'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useFilterStore } from '@/stores/filterStore'
import { PH_TZ } from '@/lib/utils'
import type { FilterZone } from '@/stores/filterStore'

export type { FilterZone }

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

export interface UseFilterTrackerReturn {
  combinedCount: number
  slimCount: number
  roundCount: number
  slimYtd: number
  roundYtd: number
  lastReplacedAt: string | null
  zone: FilterZone
  isLoading: boolean
  error: string | null
  markAsReplaced: () => Promise<void>
}

export function useFilterTracker(): UseFilterTrackerReturn {
  const stationId = useAuthStore((s) => s.stationId)
  const setCounts     = useFilterStore((s) => s.setCounts)
  const combinedCount = useFilterStore((s) => s.combinedCount)
  const slimCount     = useFilterStore((s) => s.slimCount)
  const roundCount    = useFilterStore((s) => s.roundCount)
  const slimYtd       = useFilterStore((s) => s.slimYtd)
  const roundYtd      = useFilterStore((s) => s.roundYtd)
  const lastReplacedAt = useFilterStore((s) => s.lastReplacedAt)
  const zone          = useFilterStore((s) => s.zone)

  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) { setIsLoading(false); return }
    setError(null)
    try {
      // 1. Get the last replacement timestamp
      const { data: replacements, error: rErr } = await supabase
        .from('filter_replacements')
        .select('replaced_at')
        .eq('station_id', stationId)
        .order('replaced_at', { ascending: false })
        .limit(1)

      if (rErr) throw new Error(rErr.message)

      const lastReplacedAt =
        (replacements?.[0]?.replaced_at as string | undefined) ?? null

      // Convert to PH date for comparison with sale_date (YYYY-MM-DD)
      // spec: "sale_date > MAX(replaced_at)" → sales ON the replacement day don't count
      const lastReplacedDate = lastReplacedAt
        ? formatInTimeZone(new Date(lastReplacedAt), PH_TZ, 'yyyy-MM-dd')
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

        // Since last replacement (all-time if never replaced)
        if (!lastReplacedDate || saleDate > lastReplacedDate) {
          slim  += s
          round += r
        }

        // YTD — independent of replacement resets
        if (saleDate >= ytdStart) {
          sYtd += s
          rYtd += r
        }
      }

      setCounts({
        combinedCount:  slim + round,
        slimCount:      slim,
        roundCount:     round,
        slimYtd:        sYtd,
        roundYtd:       rYtd,
        lastReplacedAt,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load filter data')
    } finally {
      setIsLoading(false)
    }
  }, [stationId, setCounts])

  useEffect(() => { void fetchData() }, [fetchData])

  const markAsReplaced = useCallback(async () => {
    if (!stationId) return
    // Use getState() to always capture the latest counts at call time
    const { slimCount, roundCount } = useFilterStore.getState()

    const { error: e } = await supabase
      .from('filter_replacements')
      .insert({
        station_id:                  stationId,
        replaced_at:                 new Date().toISOString(),
        slim_count_at_replacement:   slimCount,
        round_count_at_replacement:  roundCount,
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
    lastReplacedAt,
    zone,
    isLoading,
    error,
    markAsReplaced,
  }
}

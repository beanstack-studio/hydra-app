import { useState, useEffect, useCallback } from 'react'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useBackwashStore, DEFAULT_BACKWASH_THRESHOLD } from '@/stores/backwashStore'
import { PH_TZ } from '@/lib/utils'
import type { BackwashZone } from '@/stores/backwashStore'

export type { BackwashZone }

// Fallback when DB row exists but backwash_alert_enabled is null (defensive).
// Keeping true so the modal toggle defaults ON when first configured.
const DEFAULT_BACKWASH_ALERT_ENABLED = true

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
  backwashYtd: number
  lastBackwashedAt: string | null
  threshold: number
  alertEnabled: boolean
  zone: BackwashZone
  isLoading: boolean
  isConfigured: boolean
  error: string | null
  markAsBackwashed: () => Promise<void>
  updateThreshold: (threshold: number, alertEnabled: boolean) => Promise<void>
}

export function useBackwashTracker(): UseBackwashTrackerReturn {
  const stationId        = useAuthStore((s) => s.stationId)
  const setCounts        = useBackwashStore((s) => s.setCounts)
  const setThreshold     = useBackwashStore((s) => s.setThreshold)
  const setAlertEnabled  = useBackwashStore((s) => s.setAlertEnabled)
  const alertEnabled     = useBackwashStore((s) => s.alertEnabled)
  const isConfigured     = useBackwashStore((s) => s.isConfigured)
  const combinedCount    = useBackwashStore((s) => s.combinedCount)
  const slimCount        = useBackwashStore((s) => s.slimCount)
  const roundCount       = useBackwashStore((s) => s.roundCount)
  const slimYtd          = useBackwashStore((s) => s.slimYtd)
  const roundYtd         = useBackwashStore((s) => s.roundYtd)
  const backwashYtd      = useBackwashStore((s) => s.backwashYtd)
  const lastBackwashedAt = useBackwashStore((s) => s.lastBackwashedAt)
  const threshold        = useBackwashStore((s) => s.threshold)
  const zone             = useBackwashStore((s) => s.zone)

  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId) { setIsLoading(false); return }
    setError(null)
    try {
      const phNow      = toZonedTime(new Date(), PH_TZ)
      const ytdStartTz = `${phNow.getFullYear()}-01-01T00:00:00+08:00`

      const [logsRes, ytdCountRes, salesRes, settingsRes] = await Promise.all([
        supabase
          .from('backwash_logs')
          .select('backwashed_at')
          .eq('station_id', stationId)
          .order('backwashed_at', { ascending: false })
          .limit(1),
        supabase
          .from('backwash_logs')
          .select('*', { count: 'exact', head: true })
          .eq('station_id', stationId)
          .gte('backwashed_at', ytdStartTz),
        supabase
          .from('sales')
          .select('product_name, qty, sale_date, items')
          .eq('station_id', stationId),
        supabase
          .from('station_settings')
          .select('backwash_threshold, backwash_alert_enabled')
          .eq('station_id', stationId)
          .maybeSingle(),
      ])

      if (logsRes.error) throw new Error(logsRes.error.message)
      if (salesRes.error) throw new Error(salesRes.error.message)
      // settingsRes failure is non-fatal — fall back to unconfigured

      // ── Configured vs. not configured ────────────────────────────────────
      // "Not configured" = backwash_threshold IS NULL on station_settings
      // (or no row at all). The card renders a placeholder until the owner
      // saves a real threshold via the settings modal.
      const configured = settingsRes.data?.backwash_threshold != null

      if (!configured) {
        useBackwashStore.getState().setUnconfigured()
        return
      }

      const fetchedThreshold    = settingsRes.data!.backwash_threshold as number
      const fetchedAlertEnabled = (settingsRes.data?.backwash_alert_enabled as boolean | null | undefined)
        ?? DEFAULT_BACKWASH_ALERT_ENABLED

      // Update threshold before setCounts so zone is computed with the correct max
      setThreshold(fetchedThreshold)
      setAlertEnabled(fetchedAlertEnabled)

      const fetchedLastAt = (logsRes.data?.[0]?.backwashed_at as string | undefined) ?? null

      // Convert to PH date for comparison with sale_date (YYYY-MM-DD)
      // spec: "sale_date > MAX(backwashed_at)" → sales ON the backwash day don't count
      const lastBackwashedDate = fetchedLastAt
        ? formatInTimeZone(new Date(fetchedLastAt), PH_TZ, 'yyyy-MM-dd')
        : null

      const ytdStart = `${phNow.getFullYear()}-01-01`

      let slim = 0, round = 0
      let sYtd = 0, rYtd = 0

      for (const sale of (salesRes.data ?? []) as SaleRow[]) {
        const { slim: s, round: r } = countRefillsFromSale(sale)
        const saleDate = sale.sale_date

        if (!lastBackwashedDate || saleDate > lastBackwashedDate) {
          slim  += s
          round += r
        }
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
        backwashYtd:     ytdCountRes.count ?? 0,
        lastBackwashedAt: fetchedLastAt,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load backwash data')
    } finally {
      setIsLoading(false)
    }
  }, [stationId, setCounts, setThreshold, setAlertEnabled])

  useEffect(() => { void fetchData() }, [fetchData])

  const markAsBackwashed = useCallback(async () => {
    if (!stationId) return
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

  const updateThreshold = useCallback(async (newThreshold: number, newAlertEnabled: boolean) => {
    if (!stationId) return
    const { error: e } = await supabase
      .from('station_settings')
      .upsert(
        {
          station_id:             stationId,
          backwash_threshold:     newThreshold,
          backwash_alert_enabled: newAlertEnabled,
          updated_at:             new Date().toISOString(),
        },
        { onConflict: 'station_id' }
      )
    if (e) throw new Error(e.message)
    // fetchData re-reads the DB and sets isConfigured = true via setCounts
    await fetchData()
  }, [stationId, fetchData])

  return {
    combinedCount,
    slimCount,
    roundCount,
    slimYtd,
    roundYtd,
    backwashYtd,
    lastBackwashedAt,
    threshold,
    alertEnabled,
    zone,
    isLoading,
    isConfigured,
    error,
    markAsBackwashed,
    updateThreshold,
  }
}

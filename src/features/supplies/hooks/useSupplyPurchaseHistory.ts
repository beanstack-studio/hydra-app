import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Expense } from '@/features/expenses/types'

interface UseSupplyPurchaseHistoryReturn {
  data: Expense[]
  isLoading: boolean
  error: string | null
}

// Match expense item against supply name in both directions so renamed
// supplies still find their older expense records.
// e.g. expense item "Cap Seal" matches supply "Cap Seal - small (for Slim)"
// because the new name contains the old item label.
// Skips generic 'Supplies' label (logged without a specific supply selected).
function matchesSupply(expenseItem: string, supplyName: string): boolean {
  const item  = expenseItem.trim().toLowerCase()
  const name  = supplyName.trim().toLowerCase()
  if (!item || item === 'supplies') return false
  return item.includes(name) || name.includes(item)
}

export function useSupplyPurchaseHistory(supplyName: string | null): UseSupplyPurchaseHistoryReturn {
  const stationId = useAuthStore((s) => s.stationId)
  const [data, setData] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!stationId || !supplyName) { setData([]); return }
    setIsLoading(true)
    setError(null)
    try {
      // Fetch recent supplies-category expenses; filter client-side so renamed
      // supply items are still matched correctly.
      const { data: rows, error: e } = await supabase
        .from('expenses')
        .select('*')
        .eq('station_id', stationId)
        .eq('category', 'supplies')
        .order('expense_date', { ascending: false })
        .limit(200)
      if (e) throw new Error(e.message)

      const matched = (rows ?? [] as Expense[])
        .filter((row) => matchesSupply((row as Expense).item, supplyName))
        .slice(0, 10) as Expense[]

      setData(matched)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setIsLoading(false)
    }
  }, [stationId, supplyName])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { data, isLoading, error }
}

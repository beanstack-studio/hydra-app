import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface StoredPrefs {
  hiddenKeys?: string[]
  columnWidths?: Record<string, number>
  columnOrder?: string[]
  filterValues?: Record<string, string>
}

export interface TablePrefs {
  hiddenKeys: Set<string>
  toggleColumn: (key: string) => void
  columnWidths: Record<string, number>
  onColumnResize: (key: string, width: number) => void
  columnOrder: string[]
  onColumnReorder: (order: string[]) => void
  filterValues: Record<string, string>
  setFilterValues: (v: Record<string, string>) => void
}

function lsGet<T>(key: string, fallback: T): T {
  try {
    const r = localStorage.getItem(key)
    return r !== null ? (JSON.parse(r) as T) : fallback
  } catch {
    return fallback
  }
}

function lsSet(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)) } catch {}
}

export function useTablePrefs(tableId: string, defaultHiddenKeys: string[] = []): TablePrefs {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => {
    const r = localStorage.getItem(`table-hidden-${tableId}`)
    if (r) try { return new Set(JSON.parse(r) as string[]) } catch {}
    return new Set(defaultHiddenKeys)
  })
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    lsGet(`table-widths-${tableId}`, {})
  )
  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    lsGet(`table-order-${tableId}`, [])
  )
  const [filterValues, setFilterValuesState] = useState<Record<string, string>>(() =>
    lsGet(`table-filters-${tableId}`, {})
  )

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateRef = useRef({ hiddenKeys, columnWidths, columnOrder, filterValues })
  stateRef.current = { hiddenKeys, columnWidths, columnOrder, filterValues }

  // Load from Supabase on mount (overrides localStorage with server truth)
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const stored = (user?.user_metadata?.table_prefs?.[tableId] ?? null) as StoredPrefs | null
      if (!stored) return
      if (stored.hiddenKeys) {
        setHiddenKeys(new Set(stored.hiddenKeys))
        lsSet(`table-hidden-${tableId}`, stored.hiddenKeys)
      }
      if (stored.columnWidths && Object.keys(stored.columnWidths).length > 0) {
        setColumnWidths(stored.columnWidths)
        lsSet(`table-widths-${tableId}`, stored.columnWidths)
      }
      if (stored.columnOrder && stored.columnOrder.length > 0) {
        setColumnOrder(stored.columnOrder)
        lsSet(`table-order-${tableId}`, stored.columnOrder)
      }
      if (stored.filterValues) {
        setFilterValuesState(stored.filterValues)
        lsSet(`table-filters-${tableId}`, stored.filterValues)
      }
    }
    void load()
  }, [tableId]) // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const { hiddenKeys: hk, columnWidths: cw, columnOrder: co, filterValues: fv } = stateRef.current
      const { data: { user } } = await supabase.auth.getUser()
      const existing = (user?.user_metadata?.table_prefs ?? {}) as Record<string, StoredPrefs>
      await supabase.auth.updateUser({
        data: {
          table_prefs: {
            ...existing,
            [tableId]: {
              hiddenKeys: Array.from(hk),
              columnWidths: cw,
              columnOrder: co,
              filterValues: fv,
            },
          },
        },
      })
    }, 1000)
  }, [tableId])

  const toggleColumn = useCallback((key: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      lsSet(`table-hidden-${tableId}`, [...next])
      scheduleSave()
      return next
    })
  }, [tableId, scheduleSave])

  const onColumnResize = useCallback((key: string, width: number) => {
    setColumnWidths((prev) => {
      const next = { ...prev, [key]: width }
      lsSet(`table-widths-${tableId}`, next)
      scheduleSave()
      return next
    })
  }, [tableId, scheduleSave])

  const onColumnReorder = useCallback((order: string[]) => {
    setColumnOrder(order)
    lsSet(`table-order-${tableId}`, order)
    scheduleSave()
  }, [tableId, scheduleSave])

  const setFilterValues = useCallback((v: Record<string, string>) => {
    setFilterValuesState(v)
    lsSet(`table-filters-${tableId}`, v)
    scheduleSave()
  }, [tableId, scheduleSave])

  return { hiddenKeys, toggleColumn, columnWidths, onColumnResize, columnOrder, onColumnReorder, filterValues, setFilterValues }
}

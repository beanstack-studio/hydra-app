import { useState, useCallback } from 'react'

function loadStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function saveStorage(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

export interface TablePrefs {
  hiddenKeys: Set<string>
  toggleColumn: (key: string) => void
  columnWidths: Record<string, number>
  onColumnResize: (key: string, width: number) => void
}

export function useTablePrefs(tableId: string, defaultHiddenKeys: string[] = []): TablePrefs {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => {
    const raw = localStorage.getItem(`table-hidden-${tableId}`)
    if (raw !== null) {
      try { return new Set<string>(JSON.parse(raw) as string[]) } catch { return new Set<string>() }
    }
    return new Set<string>(defaultHiddenKeys)
  })

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    loadStorage<Record<string, number>>(`table-widths-${tableId}`, {})
  )

  const toggleColumn = useCallback((key: string) => {
    setHiddenKeys((prev) => {
      const next = new Set<string>(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      saveStorage(`table-hidden-${tableId}`, [...next])
      return next
    })
  }, [tableId])

  const onColumnResize = useCallback((key: string, width: number) => {
    setColumnWidths((prev) => {
      const next = { ...prev, [key]: width }
      saveStorage(`table-widths-${tableId}`, next)
      return next
    })
  }, [tableId])

  return { hiddenKeys, toggleColumn, columnWidths, onColumnResize }
}

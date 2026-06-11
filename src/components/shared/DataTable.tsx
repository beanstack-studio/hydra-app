import { useState, useRef, useCallback } from 'react'
import type { ReactNode, PointerEvent as ReactPointerEvent } from 'react'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ArrowUpDown, GripHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  sortable?: boolean
  className?: string
}

// Exported so table components and TableOptionsButton can reference it
export interface ColumnConfig {
  key: string
  label: string
  defaultHidden?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T) => string
  pageSize?: number
  emptyState?: ReactNode
  onRowClick?: (row: T) => void
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
  rowClassName?: (row: T) => string
  // External column visibility (from useTablePrefs)
  hiddenKeys?: Set<string>
  // External column widths (from useTablePrefs)
  columnWidths?: Record<string, number>
  // Called on resize end with final width
  onColumnResize?: (key: string, width: number) => void
  // Enables column drag-to-reorder with localStorage persistence
  tableId?: string
  // Controlled column order from useTablePrefs (for cross-device sync)
  externalColumnOrder?: string[]
  onColumnReorder?: (order: string[]) => void
}

const MIN_COL_WIDTH = 80

export function DataTable<T>({
  columns,
  data,
  rowKey,
  pageSize = 25,
  emptyState,
  onRowClick,
  sortKey,
  sortDir,
  onSort,
  rowClassName,
  hiddenKeys,
  columnWidths,
  onColumnResize,
  tableId,
  externalColumnOrder,
  onColumnReorder,
}: DataTableProps<T>) {
  const [page, setPage] = useState(0)

  // ── Column order (persisted per tableId) ─────────────────────────────────
  const [columnOrder, setColumnOrderState] = useState<string[]>(() => {
    if (!tableId) return []
    try {
      const raw = localStorage.getItem(`table-order-${tableId}`)
      return raw ? (JSON.parse(raw) as string[]) : []
    } catch { return [] }
  })

  const saveColumnOrder = useCallback((order: string[]) => {
    setColumnOrderState(order)
    if (tableId) {
      try { localStorage.setItem(`table-order-${tableId}`, JSON.stringify(order)) } catch {}
    }
    onColumnReorder?.(order)
  }, [tableId, onColumnReorder])

  // ── Column drag state ─────────────────────────────────────────────────────
  const [dragColKey, setDragColKey]   = useState<string | null>(null)
  const [dropColKey, setDropColKey]   = useState<string | null>(null)
  const dragColRef   = useRef<string | null>(null)
  const dropColRef   = useRef<string | null>(null)
  const orderedColsRef = useRef<Column<T>[]>([])

  const startColDrag = useCallback((key: string, e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!tableId) return
    e.preventDefault()
    e.stopPropagation()
    dragColRef.current = key
    dropColRef.current = null
    setDragColKey(key)
    setDropColKey(null)

    const onMove = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      const th = el?.closest('[data-col-key]') as HTMLElement | null
      const targetKey = th?.dataset.colKey ?? null
      if (targetKey !== dropColRef.current) {
        dropColRef.current = targetKey
        setDropColKey(targetKey)
      }
    }

    const onUp = () => {
      const src = dragColRef.current
      const tgt = dropColRef.current
      if (src && tgt && src !== tgt && tgt !== 'actions') {
        const keys = orderedColsRef.current
          .filter((c) => c.key !== 'actions')
          .map((c) => c.key)
        const srcIdx = keys.indexOf(src)
        const tgtIdx = keys.indexOf(tgt)
        if (srcIdx !== -1 && tgtIdx !== -1) {
          const newOrder = [...keys]
          newOrder.splice(srcIdx, 1)
          newOrder.splice(tgtIdx, 0, src)
          saveColumnOrder(newOrder)
        }
      }
      dragColRef.current = null
      dropColRef.current = null
      setDragColKey(null)
      setDropColKey(null)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [tableId, saveColumnOrder])

  // ── Column resize (pointer events — works on touch + mouse) ──────────────
  const [dragWidths, setDragWidths] = useState<Record<string, number>>({})
  const thRefs = useRef<Map<string, HTMLTableCellElement>>(new Map())
  const resizeStateRef = useRef<{
    key: string
    startX: number
    startWidth: number
    currentWidth: number
  } | null>(null)

  const startResize = useCallback((key: string, e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    const stored = columnWidths?.[key]
    const el = thRefs.current.get(key)
    const measured = el ? Math.round(el.getBoundingClientRect().width) : undefined
    const startWidth = stored ?? measured ?? 120

    resizeStateRef.current = { key, startX: e.clientX, startWidth, currentWidth: startWidth }
    document.body.style.setProperty('cursor', 'col-resize')
    document.body.style.setProperty('user-select', 'none')

    const onMove = (ev: PointerEvent) => {
      if (!resizeStateRef.current) return
      const { key, startX, startWidth } = resizeStateRef.current
      const delta = ev.clientX - startX
      const next = Math.max(MIN_COL_WIDTH, startWidth + delta)
      resizeStateRef.current.currentWidth = next
      setDragWidths((prev) => ({ ...prev, [key]: next }))
    }

    const onUp = () => {
      if (resizeStateRef.current) {
        onColumnResize?.(resizeStateRef.current.key, resizeStateRef.current.currentWidth)
      }
      resizeStateRef.current = null
      setDragWidths({})
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [columnWidths, onColumnResize])

  // ── Ordered visible columns ───────────────────────────────────────────────
  const visibleCols = columns.filter((c) => !hiddenKeys?.has(c.key))
  const nonActionCols = visibleCols.filter((c) => c.key !== 'actions')
  const actionsCols   = visibleCols.filter((c) => c.key === 'actions')

  const effectiveColumnOrder = externalColumnOrder && externalColumnOrder.length > 0
    ? externalColumnOrder
    : columnOrder

  const orderedVisibleCols: Column<T>[] = tableId && effectiveColumnOrder.length > 0
    ? [
        ...[...nonActionCols].sort((a, b) => {
          const ai = effectiveColumnOrder.indexOf(a.key)
          const bi = effectiveColumnOrder.indexOf(b.key)
          if (ai === -1 && bi === -1) return 0
          if (ai === -1) return 1
          if (bi === -1) return -1
          return ai - bi
        }),
        ...actionsCols,
      ]
    : visibleCols

  orderedColsRef.current = orderedVisibleCols

  const effectiveWidths = { ...(columnWidths ?? {}), ...dragWidths }
  const hasWidths = Object.keys(effectiveWidths).length > 0

  const totalPages = Math.ceil(data.length / pageSize)
  const start = page * pageSize
  const pageData = data.slice(start, start + pageSize)

  if (data.length === 0 && emptyState) return <>{emptyState}</>

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className={cn('text-sm', hasWidths ? 'table-fixed w-full' : 'w-max min-w-full')}>
          {hasWidths && (
            <colgroup>
              {orderedVisibleCols.map((col) => (
                <col
                  key={col.key}
                  style={effectiveWidths[col.key] ? { width: `${effectiveWidths[col.key]}px` } : undefined}
                />
              ))}
            </colgroup>
          )}
          <thead>
            <tr className="border-b border-border bg-muted/60">
              {orderedVisibleCols.map((col) => (
                <th
                  key={col.key}
                  data-col-key={col.key}
                  ref={(el) => {
                    if (el) thRefs.current.set(col.key, el)
                    else thRefs.current.delete(col.key)
                  }}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap relative',
                    hasWidths && 'overflow-hidden',
                    col.sortable && 'cursor-pointer select-none hover:text-foreground transition-colors duration-150',
                    col.className,
                    dragColKey === col.key && 'opacity-40',
                    dropColKey === col.key && dragColKey !== col.key && col.key !== 'actions' && 'bg-primary/10',
                  )}
                  onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {tableId && col.key !== 'actions' && (
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-label="Drag to reorder column"
                        className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors duration-150 shrink-0 touch-none"
                        onPointerDown={(e) => startColDrag(col.key, e)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <GripHorizontal className="h-3 w-3" />
                      </button>
                    )}
                    {col.sortable ? (
                      <span className="inline-flex items-center gap-1">
                        {col.header}
                        {sortKey === col.key ? (
                          sortDir === 'asc' ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </span>
                    ) : (
                      col.header
                    )}
                  </div>
                  {/* Resize handle — pointer events work on touch + mouse */}
                  {onColumnResize && (
                    <div
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors duration-150 z-10 touch-none"
                      onPointerDown={(e) => startResize(col.key, e)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row) => (
              <tr
                key={rowKey(row)}
                className={cn(
                  'border-b border-border last:border-0 transition-colors duration-150',
                  onRowClick && 'cursor-pointer hover:bg-accent/70',
                  rowClassName?.(row)
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {orderedVisibleCols.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3 text-foreground', hasWidths && 'overflow-hidden', col.className)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {start + 1}–{Math.min(start + pageSize, data.length)} of {data.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

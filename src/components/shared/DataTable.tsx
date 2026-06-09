import { useState, useRef, useCallback } from 'react'
import type { ReactNode, MouseEvent as ReactMouseEvent } from 'react'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react'
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
}

const MIN_COL_WIDTH = 50

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
}: DataTableProps<T>) {
  const [page, setPage] = useState(0)

  // Local drag state for visual feedback during resize (ephemeral — not persisted)
  const [dragWidths, setDragWidths] = useState<Record<string, number>>({})
  const thRefs = useRef<Map<string, HTMLTableCellElement>>(new Map())
  const resizeStateRef = useRef<{
    key: string
    startX: number
    startWidth: number
    currentWidth: number
  } | null>(null)

  const startResize = useCallback((key: string, e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    // Width priority: stored prop → measure from DOM → default
    const stored = columnWidths?.[key]
    const el = thRefs.current.get(key)
    const measured = el ? Math.round(el.getBoundingClientRect().width) : undefined
    const startWidth = stored ?? measured ?? 120

    resizeStateRef.current = { key, startX: e.clientX, startWidth, currentWidth: startWidth }

    const onMove = (ev: MouseEvent) => {
      if (!resizeStateRef.current) return
      const delta = ev.clientX - resizeStateRef.current.startX
      const next = Math.max(MIN_COL_WIDTH, resizeStateRef.current.startWidth + delta)
      resizeStateRef.current.currentWidth = next
      setDragWidths((prev) => ({ ...prev, [resizeStateRef.current!.key]: next }))
    }

    const onUp = () => {
      if (resizeStateRef.current) {
        onColumnResize?.(resizeStateRef.current.key, resizeStateRef.current.currentWidth)
      }
      resizeStateRef.current = null
      setDragWidths({})
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.body.style.setProperty('cursor', 'col-resize')
    document.body.style.setProperty('user-select', 'none')
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [columnWidths, onColumnResize])

  // Drag widths override stored widths during active resize
  const effectiveWidths = { ...(columnWidths ?? {}), ...dragWidths }
  const visibleCols = columns.filter((c) => !hiddenKeys?.has(c.key))
  const hasWidths = Object.keys(effectiveWidths).length > 0

  const totalPages = Math.ceil(data.length / pageSize)
  const start = page * pageSize
  const pageData = data.slice(start, start + pageSize)

  if (data.length === 0 && emptyState) return <>{emptyState}</>

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className={cn('w-full text-sm', hasWidths && 'table-fixed')}>
          {hasWidths && (
            <colgroup>
              {visibleCols.map((col) => (
                <col
                  key={col.key}
                  style={effectiveWidths[col.key] ? { width: `${effectiveWidths[col.key]}px` } : undefined}
                />
              ))}
            </colgroup>
          )}
          <thead>
            <tr className="border-b border-border bg-muted/60">
              {visibleCols.map((col) => (
                <th
                  key={col.key}
                  ref={(el) => {
                    if (el) thRefs.current.set(col.key, el)
                    else thRefs.current.delete(col.key)
                  }}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap relative',
                    col.sortable &&
                      'cursor-pointer select-none hover:text-foreground transition-colors duration-150',
                    col.className
                  )}
                  onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                >
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
                  {/* Resize handle — only visible when resize is enabled */}
                  {onColumnResize && (
                    <div
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors duration-150 z-10"
                      onMouseDown={(e) => startResize(col.key, e)}
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
                {visibleCols.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3 text-foreground', col.className)}>
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

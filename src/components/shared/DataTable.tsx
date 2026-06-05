import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  sortable?: boolean
  className?: string
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
}

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
}: DataTableProps<T>) {
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(data.length / pageSize)
  const start = page * pageSize
  const pageData = data.slice(start, start + pageSize)

  if (data.length === 0 && emptyState) return <>{emptyState}</>

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap',
                    col.sortable && 'cursor-pointer select-none hover:text-foreground transition-colors duration-150',
                    col.className
                  )}
                  onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                >
                  {col.sortable ? (
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {sortKey === col.key ? (
                        sortDir === 'asc'
                          ? <ChevronUp className="h-3 w-3" />
                          : <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </span>
                  ) : (
                    col.header
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
                  onRowClick && 'cursor-pointer hover:bg-accent',
                  rowClassName?.(row)
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
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

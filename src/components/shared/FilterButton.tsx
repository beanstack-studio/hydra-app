import { useRef, useState, useEffect } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterOption {
  value: string
  label: string
}

export interface FilterGroup {
  key: string
  label: string
  options: FilterOption[]
}

interface FilterButtonProps {
  groups: FilterGroup[]
  value: Record<string, string>
  onChange: (groupKey: string, value: string) => void
  onReset: () => void
}

export function FilterButton({ groups, value, onChange, onReset }: FilterButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const activeCount = Object.values(value).filter((v) => v !== '').length
  const isActive = activeCount > 0

  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [isOpen])

  const selectCls =
    'w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        title="Filter"
        onClick={() => setIsOpen((o) => !o)}
        className={cn(
          'relative flex items-center justify-center h-9 w-9 rounded-md border bg-background transition-colors duration-150',
          isActive
            ? 'border-primary text-primary'
            : 'border-input text-muted-foreground hover:text-foreground hover:border-foreground/30'
        )}
      >
        <SlidersHorizontal className="h-4 w-4" />
        {isActive && (
          <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center leading-none">
            {activeCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 max-w-[90vw] rounded-lg border border-border bg-popover shadow-lg p-3 space-y-3">
          {groups.map((group) => (
            <div key={group.key}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                {group.label}
              </p>
              <select
                value={value[group.key] ?? ''}
                onChange={(e) => onChange(group.key, e.target.value)}
                className={selectCls}
              >
                <option value="">All</option>
                {group.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          ))}

          {isActive && (
            <button
              type="button"
              onClick={() => { onReset(); setIsOpen(false) }}
              className="w-full pt-2 border-t border-border text-center text-xs text-muted-foreground hover:text-destructive transition-colors duration-150"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}

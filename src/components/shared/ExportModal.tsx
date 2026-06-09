import { useState, useEffect } from 'react'
import { FileSpreadsheet, FileJson } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/shared/Modal'
import { downloadCSV, cn } from '@/lib/utils'

export interface ExportColumnDef {
  key: string
  label: string
  defaultChecked?: boolean
}

type FileFormat = 'csv' | 'json'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  filename: string
  columns: ExportColumnDef[]
  rows: Record<string, string | number | null | undefined>[]
}

export function ExportModal({ isOpen, onClose, title, filename, columns, rows }: ExportModalProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [format, setFormat]   = useState<FileFormat>('csv')

  /* Reset to all-checked every time the modal opens */
  useEffect(() => {
    if (isOpen) {
      setChecked(Object.fromEntries(columns.map((c) => [c.key, c.defaultChecked ?? true])))
      setFormat('csv')
    }
  }, [isOpen, columns])

  const selectedCols = columns.filter((c) => checked[c.key])
  const allChecked   = selectedCols.length === columns.length
  const noneChecked  = selectedCols.length === 0

  const toggleAll = () => {
    const next = !allChecked
    setChecked(Object.fromEntries(columns.map((c) => [c.key, next])))
  }

  const toggle = (key: string) => setChecked((p) => ({ ...p, [key]: !p[key] }))

  const handleExport = () => {
    if (noneChecked) return
    const base = `${filename}-${new Date().toISOString().slice(0, 10)}`

    if (format === 'csv') {
      downloadCSV(
        `${base}.csv`,
        selectedCols.map((c) => c.label),
        rows.map((row) => selectedCols.map((c) => row[c.key] ?? ''))
      )
    } else {
      const json = rows.map((row) =>
        Object.fromEntries(selectedCols.map((c) => [c.label, row[c.key] ?? '']))
      )
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `${base}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Export ${title}`} size="sm">
      <div className="space-y-5">

        {/* ── File format ─────────────────────────────────────── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            File Format
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(['csv', 'json'] as FileFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  format === f
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                )}
              >
                {f === 'csv'
                  ? <FileSpreadsheet className="h-4 w-4 shrink-0" />
                  : <FileJson className="h-4 w-4 shrink-0" />
                }
                <span>.{f.toUpperCase()}</span>
                {f === 'csv' && (
                  <span className="ml-auto text-[10px] opacity-50 font-normal">Excel</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Column selector ─────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Columns{' '}
              <span className="font-normal normal-case text-muted-foreground">
                ({selectedCols.length} / {columns.length})
              </span>
            </p>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-medium text-primary hover:underline"
            >
              {allChecked ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border overflow-hidden">
            {columns.map((col) => (
              <label
                key={col.key}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent/60 transition-colors duration-100 select-none"
              >
                <input
                  type="checkbox"
                  checked={checked[col.key] ?? false}
                  onChange={() => toggle(col.key)}
                  className="h-4 w-4 rounded accent-primary shrink-0"
                />
                <span className="text-sm text-foreground">{col.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* ── Actions ─────────────────────────────────────────── */}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={noneChecked}
            onClick={handleExport}
          >
            Download {format.toUpperCase()}
          </Button>
        </div>

      </div>
    </Modal>
  )
}

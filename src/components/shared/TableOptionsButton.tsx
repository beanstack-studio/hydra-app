import { useState, useEffect } from 'react'
import { SlidersHorizontal, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { cn, downloadCSV, PH_TZ } from '@/lib/utils'
import { formatInTimeZone } from 'date-fns-tz'
import type { FilterGroup } from './FilterButton'
import type { ExportColumnDef } from './ExportModal'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'


type FileFormat = 'csv' | 'xlsx' | 'pdf' | 'json'

const FILE_FORMATS: { value: FileFormat; label: string }[] = [
  { value: 'csv',  label: 'CSV (.csv)'    },
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'pdf',  label: 'PDF (.pdf)'    },
  { value: 'json', label: 'JSON (.json)'  },
]

interface TableOptionsButtonProps {
  /** Filter dropdowns */
  filterGroups?: FilterGroup[]
  filterValue?: Record<string, string>
  onFilterChange?: (groupKey: string, value: string) => void
  onFilterReset?: () => void
  /** Keys excluded from the active-filter badge count (e.g. always-present month/year) */
  uncountedFilterKeys?: string[]
  /** Column visibility — drives both table display and export defaults */
  hiddenKeys?: Set<string>
  onToggleColumn?: (key: string) => void
  /** Export — the column list IS the column picker. Omit to hide export section. */
  exportColumns?: ExportColumnDef[]
  exportRows?: Record<string, string | number | null | undefined>[]
  exportFilename?: string
  exportTitle?: string
}

export function TableOptionsButton({
  filterGroups,
  filterValue = {},
  onFilterChange,
  onFilterReset,
  uncountedFilterKeys,
  hiddenKeys,
  onToggleColumn,
  exportColumns,
  exportRows,
  exportFilename = 'hydra-export',
  exportTitle = 'Export',
}: TableOptionsButtonProps) {
  const [isOpen,        setIsOpen]        = useState(false)
  const [exportChecked, setExportChecked] = useState<Record<string, boolean>>({})
  const [format,        setFormat]        = useState<FileFormat>('csv')

  const activeFilterCount = Object.entries(filterValue)
    .filter(([k, v]) => v && !uncountedFilterKeys?.includes(k))
    .length
  const hasFilters        = filterGroups  && filterGroups.length  > 0
  const hasExport         = exportColumns && exportColumns.length > 0 && exportRows

  // Initialise column checked state when dialog opens.
  // When hiddenKeys is provided, it is the source of truth:
  //   not in hiddenKeys = visible in table = checked
  //   in hiddenKeys     = hidden in table  = unchecked
  // When hiddenKeys is not provided (export-only context), fall back to defaultChecked.
  useEffect(() => {
    if (isOpen && exportColumns) {
      setExportChecked(
        Object.fromEntries(
          exportColumns.map((c) => [
            c.key,
            hiddenKeys !== undefined
              ? !hiddenKeys.has(c.key)
              : (c.defaultChecked ?? true),
          ])
        )
      )
      setFormat('csv')
    }
  }, [isOpen, exportColumns, hiddenKeys])

  if (!hasFilters && !hasExport) return null

  const selectedCols   = (exportColumns ?? []).filter((c) => exportChecked[c.key])
  const allChecked     = selectedCols.length === (exportColumns?.length ?? 0)
  const noneChecked    = selectedCols.length === 0

  const toggleAll = () => {
    const next = !allChecked
    setExportChecked(Object.fromEntries((exportColumns ?? []).map((c) => [c.key, next])))
  }

  const handleDownload = () => {
    if (!exportRows || noneChecked) return

    const base    = `${exportFilename}-${formatInTimeZone(new Date(), PH_TZ, 'yyyy-MM-dd-HHmm')}`
    const headers = selectedCols.map((c) => c.label)
    const body    = exportRows.map((row) => selectedCols.map((c) => row[c.key] ?? ''))

    if (format === 'csv') {
      downloadCSV(`${base}.csv`, headers, body)

    } else if (format === 'xlsx') {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...body])
      headers.forEach((_, i) => {
        const cell = XLSX.utils.encode_cell({ r: 0, c: i })
        if (ws[cell]) ws[cell].s = { font: { bold: true } }
      })
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, exportTitle)
      XLSX.writeFile(wb, `${base}.xlsx`)

    } else if (format === 'pdf') {
      const doc   = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      const today = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
      doc.setFontSize(13); doc.setFont('helvetica', 'bold')
      doc.text(`Hydra — ${exportTitle}`, 40, 40)
      doc.setFontSize(9);  doc.setFont('helvetica', 'normal')
      doc.setTextColor(120)
      doc.text(`Exported ${today}`, 40, 56)
      doc.setTextColor(0)
      autoTable(doc, {
        startY: 68,
        head:   [headers],
        body:   body.map((r) => r.map((v) => String(v))),
        styles:             { fontSize: 8, cellPadding: 4 },
        headStyles:         { fillColor: [8, 145, 178], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [247, 243, 234] },
        margin: { left: 40, right: 40 },
      })
      doc.save(`${base}.pdf`)

    } else {
      const json = exportRows.map((row) =>
        Object.fromEntries(selectedCols.map((c) => [c.label, row[c.key] ?? '']))
      )
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `${base}.json`; a.click()
      URL.revokeObjectURL(url)
    }

    setIsOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="Table options"
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground',
          activeFilterCount > 0 && 'border-primary text-primary'
        )}
      >
        <SlidersHorizontal className="h-4 w-4" />
        {activeFilterCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {activeFilterCount}
          </span>
        )}
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Table Options</DialogTitle>
            <DialogDescription className="sr-only">Configure filters and export options</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-1">

            {/* ── Filters ─────────────────────────────────────── */}
            {hasFilters && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Filter
                  </p>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={onFilterReset}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
                    >
                      Reset all
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                  {filterGroups!.map((group) => (
                    <div key={group.key}>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">
                        {group.label}
                      </label>
                      <select
                        value={filterValue[group.key] ?? ''}
                        onChange={(e) => onFilterChange?.(group.key, e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">All</option>
                        {group.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Columns + Export ────────────────────────────── */}
            {hasExport && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Columns
                    <span className="ml-1.5 font-normal normal-case">
                      ({selectedCols.length}/{exportColumns!.length})
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

                <div className="rounded-lg border border-border bg-muted/30 p-2 grid grid-cols-2 gap-0.5">
                  {exportColumns!.map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer hover:bg-accent/60 transition-colors duration-100 select-none"
                    >
                      <input
                        type="checkbox"
                        checked={exportChecked[col.key] ?? false}
                        onChange={() => {
                          setExportChecked((p) => ({ ...p, [col.key]: !p[col.key] }))
                          onToggleColumn?.(col.key)
                        }}
                        className="h-4 w-4 rounded accent-primary shrink-0"
                      />
                      <span className="text-sm text-foreground leading-tight">{col.label}</span>
                    </label>
                  ))}
                </div>

                <div className="flex gap-2 items-center">
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as FileFormat)}
                    className="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {FILE_FORMATS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={noneChecked}
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </button>
                </div>
              </div>
            )}

          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

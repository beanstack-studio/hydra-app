import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/shared/Modal'
import { downloadCSV } from '@/lib/utils'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface ExportColumnDef {
  key: string
  label: string
  defaultChecked?: boolean
}

type FileFormat = 'csv' | 'xlsx' | 'pdf' | 'json'

const FILE_FORMATS: { value: FileFormat; label: string }[] = [
  { value: 'csv',  label: 'CSV (.csv) — Excel & Google Sheets' },
  { value: 'xlsx', label: 'Excel (.xlsx) — Formatted spreadsheet' },
  { value: 'pdf',  label: 'PDF (.pdf) — Print-ready table' },
  { value: 'json', label: 'JSON (.json) — Raw data' },
]

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

    const base    = `${filename}-${new Date().toISOString().slice(0, 10)}`
    const headers = selectedCols.map((c) => c.label)
    const body    = rows.map((row) => selectedCols.map((c) => row[c.key] ?? ''))

    if (format === 'csv') {
      downloadCSV(`${base}.csv`, headers, body)

    } else if (format === 'xlsx') {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...body])
      /* Bold header row */
      headers.forEach((_, i) => {
        const cell = XLSX.utils.encode_cell({ r: 0, c: i })
        if (ws[cell]) ws[cell].s = { font: { bold: true } }
      })
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, title)
      XLSX.writeFile(wb, `${base}.xlsx`)

    } else if (format === 'pdf') {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      const today = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text(`Hydra — ${title}`, 40, 40)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(120)
      doc.text(`Exported ${today}`, 40, 56)
      doc.setTextColor(0)
      autoTable(doc, {
        startY: 68,
        head: [headers],
        body: body.map((r) => r.map((v) => String(v))),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [8, 145, 178], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [247, 243, 234] },
        margin: { left: 40, right: 40 },
      })
      doc.save(`${base}.pdf`)

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

        {/* ── File format dropdown ─────────────────────────────── */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            File Format
          </p>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as FileFormat)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {FILE_FORMATS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        {/* ── Column selector — 2-column grid ─────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Columns{' '}
              <span className="font-normal normal-case">
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

          <div className="rounded-lg border border-border bg-muted/30 p-2 grid grid-cols-2 gap-0.5">
            {columns.map((col) => (
              <label
                key={col.key}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer hover:bg-accent/60 transition-colors duration-100 select-none"
              >
                <input
                  type="checkbox"
                  checked={checked[col.key] ?? false}
                  onChange={() => toggle(col.key)}
                  className="h-4 w-4 rounded accent-primary shrink-0"
                />
                <span className="text-sm text-foreground leading-tight">{col.label}</span>
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
            Download {FILE_FORMATS.find((f) => f.value === format)?.value.toUpperCase()}
          </Button>
        </div>

      </div>
    </Modal>
  )
}

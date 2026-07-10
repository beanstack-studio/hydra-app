import { useEffect, useRef, useState } from 'react'
import { X, Plus } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import type { SupplyOption, FilterReplacementSupplyLink } from '../hooks/useFilterReplacement'

interface SupplyRow {
  supply_id: string
  qty: number
  inputValue: string   // text shown in the search input
}

const EMPTY_ROW: SupplyRow = { supply_id: '', qty: 1, inputValue: '' }

interface FilterReplacementSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  intervalDays: number
  alertEnabled: boolean
  linkedSupplies: FilterReplacementSupplyLink[]
  supplies: SupplyOption[]
  onSave: (intervalDays: number, supplies: FilterReplacementSupplyLink[], alertEnabled: boolean) => Promise<void>
}

export function FilterReplacementSettingsModal({
  isOpen,
  onClose,
  intervalDays,
  alertEnabled,
  linkedSupplies,
  supplies,
  onSave,
}: FilterReplacementSettingsModalProps) {
  const { toast } = useToast()

  const [selectedInterval,    setSelectedInterval]    = useState(intervalDays)
  const [localAlertEnabled,   setLocalAlertEnabled]   = useState(alertEnabled)
  const [supplyRows,       setSupplyRows]       = useState<SupplyRow[]>([{ ...EMPTY_ROW }])
  const [openDropdownIdx,  setOpenDropdownIdx]  = useState<number | null>(null)
  const [isSaving,         setIsSaving]         = useState(false)

  // Ref to track blur → click timing so the dropdown doesn't close before selection
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync state whenever the modal reopens or values change externally
  useEffect(() => {
    if (!isOpen) return
    setSelectedInterval(intervalDays)
    setLocalAlertEnabled(alertEnabled)
    setSupplyRows(linkedSupplies.length > 0
      ? linkedSupplies.map((l) => ({
          supply_id:  l.supply_id,
          qty:        l.qty,
          inputValue: supplies.find((s) => s.id === l.supply_id)?.name ?? '',
        }))
      : [{ ...EMPTY_ROW }]
    )
    setOpenDropdownIdx(null)
  }, [isOpen, intervalDays, alertEnabled, linkedSupplies, supplies])

  // ── Row helpers ──────────────────────────────────────────────────────────────

  const updateRow = (i: number, patch: Partial<SupplyRow>) => {
    setSupplyRows((prev) => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }

  const addRow    = () => { setSupplyRows((prev) => [...prev, { ...EMPTY_ROW }]); setOpenDropdownIdx(null) }
  const removeRow = (i: number) => { setSupplyRows((prev) => prev.filter((_, idx) => idx !== i)); setOpenDropdownIdx(null) }

  // ── Type-ahead search ────────────────────────────────────────────────────────
  // Results shown from the FIRST keystroke (no minimum character requirement).
  // When the field is focused but empty, shows the top-5 supplies alphabetically
  // so the user can browse without typing.

  const getResults = (term: string, rowIndex: number): SupplyOption[] => {
    const taken = new Set(
      supplyRows
        .filter((_, idx) => idx !== rowIndex && supplyRows[idx].supply_id !== '')
        .map((r) => r.supply_id)
    )
    const available = supplies.filter((s) => !taken.has(s.id))

    if (term.length === 0) {
      return available.slice(0, 5)
    }

    const lower = term.toLowerCase()
    return available.filter((s) => s.name.toLowerCase().includes(lower)).slice(0, 5)
  }

  const handleInputChange = (i: number, value: string) => {
    updateRow(i, { inputValue: value, supply_id: '' })
    setOpenDropdownIdx(i)
  }

  const handleInputFocus = (i: number) => {
    if (closeTimeout.current) clearTimeout(closeTimeout.current)
    setOpenDropdownIdx(i)
  }

  const handleInputBlur = () => {
    closeTimeout.current = setTimeout(() => setOpenDropdownIdx(null), 150)
  }

  const handleSelectSupply = (i: number, supply: SupplyOption) => {
    if (closeTimeout.current) clearTimeout(closeTimeout.current)
    updateRow(i, { supply_id: supply.id, inputValue: supply.name })
    setOpenDropdownIdx(null)
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const validLinks: FilterReplacementSupplyLink[] = supplyRows
        .filter((r) => r.supply_id !== '')
        .map((r) => ({ supply_id: r.supply_id, qty: r.qty }))
      await onSave(selectedInterval, validLinks, localAlertEnabled)
      toast({ title: 'Filter replacement settings saved' })
      onClose()
    } catch (e) {
      toast({
        title: 'Failed to save settings',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Filter Replacement Settings" size="sm">
      <div className="space-y-5">

        {/* Replacement interval — typed number input */}
        <div className="space-y-1.5">
          <Label htmlFor="fr-interval">Replacement schedule</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Replace filters every</span>
            <Input
              id="fr-interval"
              type="number"
              min={1}
              step={1}
              value={selectedInterval}
              onChange={(e) => setSelectedInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
        </div>

        {/* Supply deduction — type-ahead search, multiple rows */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Deduct supply when replaced</Label>
            <span className="text-xs text-muted-foreground">Supply · Qty</span>
          </div>

          {supplyRows.map((row, i) => {
            const results    = getResults(row.inputValue, i)
            const dropdownOn = openDropdownIdx === i
            return (
              <div key={i} className="flex items-center gap-2">
                {/* Type-ahead search input — results from first keystroke */}
                <div className="relative flex-1">
                  <Input
                    type="text"
                    placeholder="Search supply…"
                    value={row.inputValue}
                    onChange={(e) => handleInputChange(i, e.target.value)}
                    onFocus={() => handleInputFocus(i)}
                    onBlur={handleInputBlur}
                    autoComplete="off"
                  />
                  {dropdownOn && results.length > 0 && (
                    <div className="absolute top-full left-0 z-50 mt-0.5 w-full rounded-md border border-border bg-popover shadow-md overflow-hidden">
                      {results.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSelectSupply(i, s)}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Qty */}
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={row.supply_id ? row.qty : ''}
                  onChange={(e) => updateRow(i, { qty: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  disabled={!row.supply_id}
                  placeholder="1"
                  className="w-20 shrink-0"
                />

                {/* Remove row — only when more than one row exists */}
                {supplyRows.length > 1 && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeRow(i)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )
          })}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-primary gap-1 px-1"
            onClick={addRow}
          >
            <Plus className="h-3 w-3" />
            Add another product
          </Button>
        </div>

        {/* Login alert toggle */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="fr-alert-enabled">Show login reminder when overdue</Label>
            <Switch
              id="fr-alert-enabled"
              checked={localAlertEnabled}
              onCheckedChange={setLocalAlertEnabled}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Badge will still show even if reminders are muted.
          </p>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={isSaving} onClick={() => void handleSave()}>
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

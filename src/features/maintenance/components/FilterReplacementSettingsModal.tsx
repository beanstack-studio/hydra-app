import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Plus } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import type { SupplyOption, FilterReplacementSupplyLink } from '../hooks/useFilterReplacement'

const schema = z.object({
  day: z.coerce
    .number({ invalid_type_error: 'Enter a number' })
    .int('Must be a whole number')
    .min(1, 'Must be between 1 and 31')
    .max(31, 'Must be between 1 and 31'),
})

type FormValues = z.infer<typeof schema>

interface SupplyRow {
  supply_id: string
  qty: number
  inputValue: string   // text shown in the search input
}

const EMPTY_ROW: SupplyRow = { supply_id: '', qty: 1, inputValue: '' }

interface FilterReplacementSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  replacementDay: number
  linkedSupplies: FilterReplacementSupplyLink[]
  supplies: SupplyOption[]
  onSave: (day: number, supplies: FilterReplacementSupplyLink[]) => Promise<void>
}

export function FilterReplacementSettingsModal({
  isOpen,
  onClose,
  replacementDay,
  linkedSupplies,
  supplies,
  onSave,
}: FilterReplacementSettingsModalProps) {
  const { toast } = useToast()

  const [supplyRows,       setSupplyRows]       = useState<SupplyRow[]>([{ ...EMPTY_ROW }])
  const [openDropdownIdx,  setOpenDropdownIdx]  = useState<number | null>(null)

  // Ref to track blur → click timing so the dropdown doesn't close before selection
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { day: replacementDay },
  })

  // Sync form + local state whenever the modal reopens or values change externally
  useEffect(() => {
    if (!isOpen) return
    reset({ day: replacementDay })
    if (linkedSupplies.length > 0) {
      setSupplyRows(linkedSupplies.map((l) => ({
        supply_id:  l.supply_id,
        qty:        l.qty,
        inputValue: supplies.find((s) => s.id === l.supply_id)?.name ?? '',
      })))
    } else {
      setSupplyRows([{ ...EMPTY_ROW }])
    }
    setOpenDropdownIdx(null)
  }, [isOpen, replacementDay, linkedSupplies, supplies, reset])

  // ── Row helpers ──────────────────────────────────────────────────────────────

  const updateRow = (i: number, patch: Partial<SupplyRow>) => {
    setSupplyRows((prev) => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }

  const addRow = () => {
    setSupplyRows((prev) => [...prev, { ...EMPTY_ROW }])
    setOpenDropdownIdx(null)
  }

  const removeRow = (i: number) => {
    setSupplyRows((prev) => prev.filter((_, idx) => idx !== i))
    setOpenDropdownIdx(null)
  }

  // ── Type-ahead search ────────────────────────────────────────────────────────

  // Returns top-5 supplies matching the term (case-insensitive substring),
  // excluding supplies already selected in other rows.
  const getResults = (term: string, rowIndex: number): SupplyOption[] => {
    if (term.length < 3) return []
    const lower   = term.toLowerCase()
    const taken   = new Set(
      supplyRows
        .filter((_, idx) => idx !== rowIndex && supplyRows[idx].supply_id !== '')
        .map((r) => r.supply_id)
    )
    return supplies
      .filter((s) => !taken.has(s.id) && s.name.toLowerCase().includes(lower))
      .slice(0, 5)
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
    // Delay to allow the click on a result to fire first
    closeTimeout.current = setTimeout(() => setOpenDropdownIdx(null), 150)
  }

  const handleSelectSupply = (i: number, supply: SupplyOption) => {
    if (closeTimeout.current) clearTimeout(closeTimeout.current)
    updateRow(i, { supply_id: supply.id, inputValue: supply.name })
    setOpenDropdownIdx(null)
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  const onSubmit = async (values: FormValues) => {
    try {
      const validLinks: FilterReplacementSupplyLink[] = supplyRows
        .filter((r) => r.supply_id !== '')
        .map((r) => ({ supply_id: r.supply_id, qty: r.qty }))
      await onSave(values.day, validLinks)
      toast({ title: 'Filter replacement settings saved' })
      onClose()
    } catch (e) {
      toast({
        title: 'Failed to save settings',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Filter Replacement Settings" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Replacement schedule */}
        <div className="space-y-1.5">
          <Label htmlFor="fr-day">Replacement schedule</Label>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Replace filters on day</span>
            <Input
              id="fr-day"
              type="number"
              min={1}
              max={31}
              className="w-20"
              {...register('day')}
            />
            <span className="text-sm text-muted-foreground">of each month</span>
          </div>
          {errors.day && (
            <p className="text-xs text-destructive">{errors.day.message}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            If the chosen day doesn&apos;t exist in a given month (e.g. day 31 in
            February), the last valid day of that month is used automatically.
          </p>
        </div>

        {/* Supply deduction — type-ahead search, multiple rows */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Deduct supply when replaced</Label>
            <span className="text-xs text-muted-foreground">Supply · Qty</span>
          </div>

          {supplyRows.map((row, i) => {
            const results    = getResults(row.inputValue, i)
            const dropdownOn = openDropdownIdx === i && row.inputValue.length >= 3
            return (
              <div key={i} className="flex items-center gap-2">
                {/* Type-ahead search input */}
                <div className="relative flex-1">
                  <Input
                    type="text"
                    placeholder="Search supply… (3+ chars)"
                    value={row.inputValue}
                    onChange={(e) => handleInputChange(i, e.target.value)}
                    onFocus={() => handleInputFocus(i)}
                    onBlur={handleInputBlur}
                    autoComplete="off"
                  />
                  {dropdownOn && (
                    <div className="absolute top-full left-0 z-50 mt-0.5 w-full rounded-md border border-border bg-popover shadow-md overflow-hidden">
                      {results.length > 0 ? (
                        results.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSelectSupply(i, s)}
                          >
                            {s.name}
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-2 text-sm text-muted-foreground">No matches</p>
                      )}
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

                {/* Remove row — only when there is more than one row */}
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

          <p className="text-xs text-muted-foreground">
            Optional. When set, clicking &ldquo;Mark as Replaced&rdquo; deducts each
            linked supply&rsquo;s qty from stock automatically.
          </p>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

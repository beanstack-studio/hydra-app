import { forwardRef, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface CurrencyInputProps {
  id?: string
  value: number | null | undefined
  onChange: (value: number | null) => void
  max?: number
  placeholder?: string
  disabled?: boolean
  hasError?: boolean
  className?: string
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ id, value, onChange, max, placeholder = '0.00', disabled, hasError, className }, ref) => {
    const toDisplay = (v: number | null | undefined): string => {
      if (v == null || isNaN(v as number) || v === 0) return ''
      return v.toString()
    }

    const [displayVal, setDisplayVal] = useState<string>(() => toDisplay(value))
    const [isFocused, setIsFocused] = useState(false)

    useEffect(() => {
      if (!isFocused) {
        setDisplayVal(toDisplay(value))
      }
    }, [value, isFocused])

    const handleFocus = () => setIsFocused(true)

    const handleBlur = () => {
      setIsFocused(false)
      if (displayVal === '' || displayVal === '.') {
        setDisplayVal('')
        onChange(null)
        return
      }
      const num = parseFloat(displayVal)
      if (!isNaN(num) && num > 0) {
        const capped = max !== undefined ? Math.min(num, max) : num
        setDisplayVal(capped.toFixed(2))
        onChange(capped)
      } else {
        setDisplayVal('')
        onChange(null)
      }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      const cleaned = raw.replace(/[^0-9.]/g, '')
      const dotIdx = cleaned.indexOf('.')
      const sanitized =
        dotIdx === -1
          ? cleaned
          : cleaned.slice(0, dotIdx + 1) + cleaned.slice(dotIdx + 1).replace(/\./g, '')
      setDisplayVal(sanitized)

      if (sanitized === '' || sanitized === '.') {
        onChange(null)
        return
      }
      const num = parseFloat(sanitized)
      if (!isNaN(num)) {
        onChange(max !== undefined ? Math.min(num, max) : num)
      }
    }

    return (
      <div
        className={cn(
          'flex items-center rounded-md border bg-background transition-colors duration-150',
          hasError
            ? 'border-destructive focus-within:ring-destructive/40'
            : 'border-input focus-within:ring-ring focus-within:border-ring',
          'focus-within:ring-2 focus-within:outline-none',
          className
        )}
      >
        <span className="pl-3 text-sm text-muted-foreground select-none shrink-0">₱</span>
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="decimal"
          value={displayVal}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'flex-1 min-w-0 bg-transparent text-right px-3 py-2 text-sm font-semibold outline-none',
            'placeholder:text-muted-foreground placeholder:font-normal',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
        />
      </div>
    )
  }
)

CurrencyInput.displayName = 'CurrencyInput'

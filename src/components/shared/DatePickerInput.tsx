import { CalendarDays } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'

interface DatePickerInputProps {
  id?: string
  value: string
  onChange: (val: string) => void
  min?: string
  max?: string
  className?: string
}

export function DatePickerInput({ id, value, onChange, min, max, className }: DatePickerInputProps) {
  const display = value ? formatDate(value) : 'Select date'

  return (
    <div
      className={cn(
        'relative flex items-center gap-2 h-9 rounded-md border border-input bg-background px-3 cursor-pointer select-none overflow-hidden',
        className
      )}
    >
      <span className={cn('flex-1 text-sm truncate', value ? 'text-foreground' : 'text-muted-foreground')}>
        {display}
      </span>
      <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground pointer-events-none" />
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
      />
    </div>
  )
}

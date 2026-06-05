import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface SearchInputProps {
  onSearch: (query: string) => void
  placeholder?: string
  minChars?: number
  className?: string
}

export function SearchInput({
  onSearch,
  placeholder = 'Search…',
  minChars = 3,
  className,
}: SearchInputProps) {
  const [value, setValue] = useState('')

  useEffect(() => {
    if (value.length === 0) {
      onSearch('')
    } else if (value.length >= minChars) {
      onSearch(value)
    }
  }, [value, minChars, onSearch])

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="pl-9"
      />
    </div>
  )
}

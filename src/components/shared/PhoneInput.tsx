import { useController } from 'react-hook-form'
import type { Control, FieldValues, Path } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { formatPhone, cleanPhone } from '@/lib/utils'

interface PhoneInputProps<T extends FieldValues> {
  name: Path<T>
  control: Control<T>
  id?: string
  placeholder?: string
}

export function PhoneInput<T extends FieldValues>({
  name,
  control,
  id,
  placeholder,
}: PhoneInputProps<T>) {
  const { field } = useController({ name, control })
  const displayed = formatPhone((field.value as string) ?? '')

  return (
    <Input
      id={id}
      type="tel"
      placeholder={placeholder ?? '09xx xxx xxxx'}
      value={displayed}
      onChange={(e) => {
        field.onChange(cleanPhone(e.target.value))
      }}
      onBlur={field.onBlur}
    />
  )
}

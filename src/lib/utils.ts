import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'

export const PH_TZ = 'Asia/Manila'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export const nowPH = (): Date => toZonedTime(new Date(), PH_TZ)

export const formatCurrency = (amount: number): string =>
  `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

export const formatDate = (date: Date | string): string =>
  formatInTimeZone(new Date(date), PH_TZ, 'dd-MMM-yyyy')

export const formatTime = (date: Date | string): string =>
  formatInTimeZone(new Date(date), PH_TZ, 'h:mm a')

export const generateTimeSlots = (): string[] => {
  const slots: string[] = []
  for (let h = 0; h < 24; h++)
    for (let m = 0; m < 60; m += 15) {
      const d = new Date(2000, 0, 1, h, m)
      slots.push(format(d, 'h:mm a'))
    }
  return slots
}

// Returns only the slots between openTime and closeTime (inclusive).
// Falls back to the full list if either boundary isn't found.
export const generateTimeSlotsInRange = (openTime: string, closeTime: string): string[] => {
  const all = generateTimeSlots()
  const start = all.indexOf(openTime)
  const end = all.indexOf(closeTime)
  if (start === -1 || end === -1 || end < start) return all
  return all.slice(start, end + 1)
}

export const formatPhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('09') && digits.length <= 11)
    return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 11)]
      .filter(Boolean)
      .join(' ')
  if (digits.startsWith('0') && !digits.startsWith('09') && digits.length <= 10)
    return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)]
      .filter(Boolean)
      .join(' ')
  if (!digits.startsWith('0') && digits.length <= 7)
    return [digits.slice(0, 3), digits.slice(3, 7)]
      .filter(Boolean)
      .join(' ')
  return raw
}

export const cleanPhone = (formatted: string): string =>
  formatted.replace(/\D/g, '')

export function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): void {
  const escape = (v: string | number | null | undefined): string => {
    if (v == null) return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const lines = [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ].join('\n')
  const blob = new Blob(['\uFEFF' + lines], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Title-case a string: capitalises first letter of each word.
// Preserves intentional ALL-CAPS words (e.g. "ABL" stays "ABL", not "Abl").
export const toTitleCase = (str: string): string =>
  str.trim().replace(/\S+/g, (word) =>
    word.length > 1 && word === word.toUpperCase()
      ? word
      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  )

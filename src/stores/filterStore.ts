import { create } from 'zustand'

export type FilterZone = 'green' | 'yellow' | 'red'

export function computeFilterZone(count: number): FilterZone {
  if (count >= 270) return 'red'
  if (count >= 200) return 'yellow'
  return 'green'
}

interface FilterStoreState {
  combinedCount: number
  slimCount: number
  roundCount: number
  slimYtd: number
  roundYtd: number
  lastReplacedAt: string | null
  zone: FilterZone
  /** True once the first successful fetch has completed. Used to gate the login alert. */
  isLoaded: boolean
  setCounts: (data: {
    combinedCount: number
    slimCount: number
    roundCount: number
    slimYtd: number
    roundYtd: number
    lastReplacedAt: string | null
  }) => void
}

export const useFilterStore = create<FilterStoreState>()((set) => ({
  combinedCount: 0,
  slimCount: 0,
  roundCount: 0,
  slimYtd: 0,
  roundYtd: 0,
  lastReplacedAt: null,
  zone: 'green',
  isLoaded: false,
  setCounts: (data) =>
    set({ ...data, zone: computeFilterZone(data.combinedCount), isLoaded: true }),
}))

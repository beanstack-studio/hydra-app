import { create } from 'zustand'

export type BackwashZone = 'green' | 'yellow' | 'red'

export function computeBackwashZone(count: number): BackwashZone {
  if (count >= 270) return 'red'
  if (count >= 200) return 'yellow'
  return 'green'
}

interface BackwashStoreState {
  combinedCount: number
  slimCount: number
  roundCount: number
  slimYtd: number
  roundYtd: number
  lastBackwashedAt: string | null
  zone: BackwashZone
  /** True once the first successful fetch has completed. Used to gate the login alert. */
  isLoaded: boolean
  setCounts: (data: {
    combinedCount: number
    slimCount: number
    roundCount: number
    slimYtd: number
    roundYtd: number
    lastBackwashedAt: string | null
  }) => void
}

export const useBackwashStore = create<BackwashStoreState>()((set) => ({
  combinedCount: 0,
  slimCount: 0,
  roundCount: 0,
  slimYtd: 0,
  roundYtd: 0,
  lastBackwashedAt: null,
  zone: 'green',
  isLoaded: false,
  setCounts: (data) =>
    set({ ...data, zone: computeBackwashZone(data.combinedCount), isLoaded: true }),
}))

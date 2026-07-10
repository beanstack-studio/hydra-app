import { create } from 'zustand'

export type BackwashZone = 'green' | 'yellow' | 'red'

export const DEFAULT_BACKWASH_THRESHOLD = 300

// Zone thresholds scale proportionally with the configured max.
// Ratios mirror the original 200/300 (≈66.7%) and 270/300 (90%) cutoffs.
export function computeBackwashZone(count: number, threshold: number): BackwashZone {
  const yellowMin = Math.round(threshold * (200 / 300))
  const redMin    = Math.round(threshold * (270 / 300))
  if (count >= redMin) return 'red'
  if (count >= yellowMin) return 'yellow'
  return 'green'
}

interface BackwashStoreState {
  combinedCount: number
  slimCount: number
  roundCount: number
  slimYtd: number
  roundYtd: number
  backwashYtd: number
  lastBackwashedAt: string | null
  threshold: number
  zone: BackwashZone
  /** True once the first successful fetch has completed. Used to gate the login alert. */
  isLoaded: boolean
  /** When false, the login popup is suppressed even when zone is red. Badge still shows. */
  alertEnabled: boolean
  setCounts: (data: {
    combinedCount: number
    slimCount: number
    roundCount: number
    slimYtd: number
    roundYtd: number
    backwashYtd: number
    lastBackwashedAt: string | null
  }) => void
  setThreshold: (threshold: number) => void
  setAlertEnabled: (enabled: boolean) => void
}

export const useBackwashStore = create<BackwashStoreState>()((set) => ({
  combinedCount: 0,
  slimCount: 0,
  roundCount: 0,
  slimYtd: 0,
  roundYtd: 0,
  backwashYtd: 0,
  lastBackwashedAt: null,
  threshold: DEFAULT_BACKWASH_THRESHOLD,
  zone: 'green',
  isLoaded: false,
  alertEnabled: true,
  setCounts: (data) =>
    set((state) => ({
      ...data,
      zone: computeBackwashZone(data.combinedCount, state.threshold),
      isLoaded: true,
    })),
  setThreshold: (threshold) =>
    set((state) => ({
      threshold,
      zone: computeBackwashZone(state.combinedCount, threshold),
    })),
  setAlertEnabled: (enabled) => set({ alertEnabled: enabled }),
}))

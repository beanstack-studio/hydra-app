import { create } from 'zustand'

export type BacteriologicalTestZone = 'green' | 'yellow' | 'red'

interface BacteriologicalTestStoreState {
  zone: BacteriologicalTestZone
  isLoaded: boolean
  /** True only when bacteriological_test_interval_days is non-null on station_settings. */
  isConfigured: boolean
  /** When false, the login popup is suppressed even when zone is red. Badge still shows. */
  alertEnabled: boolean
  setZone: (zone: BacteriologicalTestZone) => void
  setAlertEnabled: (enabled: boolean) => void
  setUnconfigured: () => void
}

export const useBacteriologicalTestStore = create<BacteriologicalTestStoreState>()((set) => ({
  zone:         'green',
  isLoaded:     false,
  isConfigured: false,
  alertEnabled: false,
  setZone:        (zone) => set({ zone, isLoaded: true, isConfigured: true }),
  setAlertEnabled:(enabled) => set({ alertEnabled: enabled }),
  setUnconfigured: () => set({ zone: 'green', isLoaded: true, isConfigured: false, alertEnabled: false }),
}))

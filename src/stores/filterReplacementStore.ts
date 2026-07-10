import { create } from 'zustand'

export type FilterReplacementZone = 'green' | 'yellow' | 'red'

interface FilterReplacementStoreState {
  zone: FilterReplacementZone
  isLoaded: boolean
  /** True only when filter_replacement_interval_days is non-null on station_settings.
   *  Suppresses badge, "!" indicator, and login alert when false. */
  isConfigured: boolean
  /** When false, the login popup is suppressed even when zone is red. Badge still shows. */
  alertEnabled: boolean
  setZone: (zone: FilterReplacementZone) => void
  setAlertEnabled: (enabled: boolean) => void
  /** Called when the station has no filter replacement interval configured. Resets to neutral state. */
  setUnconfigured: () => void
}

export const useFilterReplacementStore = create<FilterReplacementStoreState>()((set) => ({
  zone: 'green',
  isLoaded: false,
  isConfigured: false,
  alertEnabled: false,
  setZone: (zone) => set({ zone, isLoaded: true, isConfigured: true }),
  setAlertEnabled: (enabled) => set({ alertEnabled: enabled }),
  setUnconfigured: () => set({
    zone: 'green',
    isLoaded: true,
    isConfigured: false,
    alertEnabled: false,
  }),
}))

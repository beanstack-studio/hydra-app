import { create } from 'zustand'

export type FilterReplacementZone = 'green' | 'yellow' | 'red'

interface FilterReplacementStoreState {
  zone: FilterReplacementZone
  isLoaded: boolean
  /** When false, the login popup is suppressed even when zone is red. Badge still shows. */
  alertEnabled: boolean
  setZone: (zone: FilterReplacementZone) => void
  setAlertEnabled: (enabled: boolean) => void
}

export const useFilterReplacementStore = create<FilterReplacementStoreState>()((set) => ({
  zone: 'green',
  isLoaded: false,
  alertEnabled: true,
  setZone: (zone) => set({ zone, isLoaded: true }),
  setAlertEnabled: (enabled) => set({ alertEnabled: enabled }),
}))

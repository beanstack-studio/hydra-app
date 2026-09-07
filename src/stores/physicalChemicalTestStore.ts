import { create } from 'zustand'

export type PhysicalChemicalTestZone = 'green' | 'yellow' | 'red'

interface PhysicalChemicalTestStoreState {
  zone: PhysicalChemicalTestZone
  isLoaded: boolean
  /** True only when physical_chemical_test_interval_days is non-null on station_settings. */
  isConfigured: boolean
  /** When false, the login popup is suppressed even when zone is red. Badge still shows. */
  alertEnabled: boolean
  setZone: (zone: PhysicalChemicalTestZone) => void
  setAlertEnabled: (enabled: boolean) => void
  setUnconfigured: () => void
}

export const usePhysicalChemicalTestStore = create<PhysicalChemicalTestStoreState>()((set) => ({
  zone:         'green',
  isLoaded:     false,
  isConfigured: false,
  alertEnabled: false,
  setZone:        (zone) => set({ zone, isLoaded: true, isConfigured: true }),
  setAlertEnabled:(enabled) => set({ alertEnabled: enabled }),
  setUnconfigured: () => set({ zone: 'green', isLoaded: true, isConfigured: false, alertEnabled: false }),
}))

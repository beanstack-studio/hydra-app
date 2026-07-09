import { create } from 'zustand'

export type FilterReplacementZone = 'green' | 'yellow' | 'red'

interface FilterReplacementStoreState {
  zone: FilterReplacementZone
  isLoaded: boolean
  setZone: (zone: FilterReplacementZone) => void
}

export const useFilterReplacementStore = create<FilterReplacementStoreState>()((set) => ({
  zone: 'green',
  isLoaded: false,
  setZone: (zone) => set({ zone, isLoaded: true }),
}))

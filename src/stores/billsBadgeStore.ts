import { create } from 'zustand'

export type BillsBadgeZone = 'green' | 'yellow' | 'red'

interface BillsBadgeStoreState {
  zone: BillsBadgeZone
  setZone: (zone: BillsBadgeZone) => void
}

export const useBillsBadgeStore = create<BillsBadgeStoreState>()((set) => ({
  zone: 'green',
  setZone: (zone) => set({ zone }),
}))

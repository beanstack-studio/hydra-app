import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'

export interface Station {
  id: string
  name: string
  plan: 'free' | 'basic' | 'pro'
  owner_name?: string | null
  photo_url?: string | null
}

type Role = 'owner' | 'staff' | 'super_admin'

interface AuthState {
  user: User | null
  stationId: string | null
  role: Role | null
  station: Station | null
  isInitialized: boolean
  isPasswordRecovery: boolean
  noStation: boolean
  setAuth: (params: { user: User; stationId: string; role: Role; station: Station }) => void
  setStation: (station: Station) => void
  clearAuth: () => void
  setInitialized: () => void
  setPasswordRecovery: (v: boolean) => void
  setNoStation: () => void
  setViewRole: (r: Role) => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  stationId: null,
  role: null,
  station: null,
  isInitialized: false,
  isPasswordRecovery: false,
  noStation: false,
  setAuth: ({ user, stationId, role, station }) =>
    set({ user, stationId, role, station, noStation: false, isPasswordRecovery: false }),
  setStation: (station) =>
    set({ station }),
  clearAuth: () =>
    set({ user: null, stationId: null, role: null, station: null, noStation: false }),
  setInitialized: () =>
    set({ isInitialized: true }),
  setPasswordRecovery: (v: boolean) =>
    set({ isPasswordRecovery: v }),
  setNoStation: () =>
    set({ isInitialized: true, noStation: true }),
  setViewRole: (r: Role) =>
    set({ role: r }),
}))

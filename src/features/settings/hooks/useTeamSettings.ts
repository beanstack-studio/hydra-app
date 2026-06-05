import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { PayType } from '@/features/settings/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StaffMember {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  pay_type: PayType | null
  pay_rate: number | null
  created_at: string
}

export interface AccessUser {
  id: string
  full_name: string | null
  email: string | null
  role: 'owner' | 'staff'
  created_at: string
}

export interface Invitation {
  id: string
  email: string
  full_name: string | null
  invited_at: string
}

export interface MemberInput {
  full_name: string
  phone?: string
  email?: string
  pay_type?: PayType
  pay_rate?: number | null
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseTeamSettingsReturn {
  staff: StaffMember[]
  isLoading: boolean
  addMember: (input: MemberInput) => Promise<void>
  editMember: (id: string, input: MemberInput) => Promise<void>
  removeMember: (id: string) => Promise<void>
  sendInvite: (email: string, fullName: string) => Promise<void>
}

export function useTeamSettings(): UseTeamSettingsReturn {
  const stationId = useAuthStore((s) => s.stationId)
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!stationId) { setIsLoading(false); return }
    const { data } = await supabase
      .from('staff')
      .select('id, full_name, phone, email, pay_type, pay_rate, created_at')
      .eq('station_id', stationId)
      .order('created_at')
    setStaff((data ?? []) as StaffMember[])
    setIsLoading(false)
  }, [stationId])

  useEffect(() => { void fetchAll() }, [fetchAll])

  const addMember = useCallback(async (input: MemberInput) => {
    if (!stationId) return
    const { error } = await supabase.from('staff').insert({
      station_id: stationId,
      full_name: input.full_name,
      phone: input.phone || null,
      email: input.email || null,
      pay_type: input.pay_type ?? 'daily',
      pay_rate: input.pay_rate ?? null,
    })
    if (error) throw new Error(error.message)
    await fetchAll()
  }, [stationId, fetchAll])

  const editMember = useCallback(async (id: string, input: MemberInput) => {
    if (!stationId) return
    const { error } = await supabase
      .from('staff')
      .update({
        full_name: input.full_name,
        phone: input.phone || null,
        email: input.email || null,
        pay_type: input.pay_type ?? 'daily',
        pay_rate: input.pay_rate ?? null,
      })
      .eq('id', id)
      .eq('station_id', stationId)
    if (error) throw new Error(error.message)
    await fetchAll()
  }, [stationId, fetchAll])

  const removeMember = useCallback(async (id: string) => {
    if (!stationId) return
    const { error } = await supabase.from('staff').delete().eq('id', id).eq('station_id', stationId)
    if (error) throw new Error(error.message)
    await fetchAll()
  }, [stationId, fetchAll])

  const sendInvite = useCallback(async (email: string, fullName: string) => {
    if (!stationId) return
    const { error: inviteErr } = await supabase.from('invitations').insert({
      station_id: stationId,
      email,
      full_name: fullName,
    })
    if (inviteErr) throw new Error(inviteErr.message)

    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    })
    if (otpErr) throw new Error(otpErr.message)

    await fetchAll()
  }, [stationId, fetchAll])

  return { staff, isLoading, addMember, editMember, removeMember, sendInvite }
}

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
  activeEmails: Set<string>
  pendingInviteEmails: Set<string>
  isLoading: boolean
  addMember: (input: MemberInput) => Promise<void>
  editMember: (id: string, input: MemberInput) => Promise<void>
  removeMember: (id: string) => Promise<void>
  sendInvite: (email: string, fullName: string) => Promise<void>
  revokeAccess: (staffId: string) => Promise<void>
}

export function useTeamSettings(): UseTeamSettingsReturn {
  const stationId = useAuthStore((s) => s.stationId)
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [activeEmails, setActiveEmails] = useState<Set<string>>(new Set())
  const [pendingInviteEmails, setPendingInviteEmails] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!stationId) { setIsLoading(false); return }

    const [staffResult, emailsResult, pendingResult] = await Promise.all([
      supabase
        .from('staff')
        .select('id, full_name, phone, email, pay_type, pay_rate, created_at')
        .eq('station_id', stationId)
        .order('created_at'),
      // users table RLS only allows reading your own row, so a direct SELECT
      // would return nothing for staff in the owner's station. Use the
      // SECURITY DEFINER RPC which bypasses RLS and returns staff emails only.
      supabase.rpc('get_station_staff_emails'),
      // invitations table RLS only allows reading your own row, so a direct
      // SELECT returns nothing for the owner. SECURITY DEFINER RPC returns
      // all pending invitations for the caller's station.
      supabase.rpc('get_station_pending_invites'),
    ])

    setStaff((staffResult.data ?? []) as StaffMember[])

    const emailSet = new Set(
      ((emailsResult.data ?? []) as Array<{ email: string }>)
        .map((u) => u.email.toLowerCase()),
    )
    setActiveEmails(emailSet)

    const pendingSet = new Set(
      ((pendingResult.data ?? []) as Array<{ email: string }>)
        .map((i) => i.email.toLowerCase()),
    )
    setPendingInviteEmails(pendingSet)

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

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const { data, error } = await supabase.functions.invoke('invite-staff', {
      body: {
        email,
        full_name: fullName,
        redirect_to: window.location.origin,
      },
    })

    if (error) {
      // FunctionsHttpError.context is the raw Response — read the actual error body
      let message = error.message
      const ctx = (error as unknown as { context?: Response }).context
      if (ctx) {
        try {
          const body = await ctx.json() as { error?: string }
          if (body.error) message = body.error
        } catch { /* ignore JSON parse failures */ }
      }
      throw new Error(message)
    }
    if ((data as { error?: string } | null)?.error) {
      throw new Error((data as { error: string }).error)
    }

    await fetchAll()
  }, [stationId, fetchAll])

  const revokeAccess = useCallback(async (staffId: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const { data, error } = await supabase.functions.invoke('revoke-staff-access', {
      body: { staff_id: staffId },
    })

    if (error) {
      let message = error.message
      const ctx = (error as unknown as { context?: Response }).context
      if (ctx) {
        try {
          const body = await ctx.json() as { error?: string }
          if (body.error) message = body.error
        } catch { /* ignore */ }
      }
      throw new Error(message)
    }
    if ((data as { error?: string } | null)?.error) {
      throw new Error((data as { error: string }).error)
    }

    await fetchAll()
  }, [fetchAll])

  return { staff, activeEmails, pendingInviteEmails, isLoading, addMember, editMember, removeMember, sendInvite, revokeAccess }
}

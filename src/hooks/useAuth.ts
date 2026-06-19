import { useEffect, useCallback, useRef } from 'react'
import type { Session, RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Station } from '@/stores/authStore'

const DEV_USER_PREFIX = 'dev-'

type Role = 'owner' | 'staff' | 'super_admin'

export function useAuth() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const setStation = useAuthStore((s) => s.setStation)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const setInitialized = useAuthStore((s) => s.setInitialized)
  const setNoStation = useAuthStore((s) => s.setNoStation)
  const stationChannelRef = useRef<RealtimeChannel | null>(null)

  const loadSession = useCallback(async (session: Session | null) => {
    if (!session) {
      const currentId = useAuthStore.getState().user?.id ?? ''
      if (!currentId.startsWith(DEV_USER_PREFIX)) {
        clearAuth()
      }
      setInitialized()
      return
    }

    // Primary: read custom claims stamped by the Postgres JWT hook
    const claimStationId = session.user.app_metadata?.station_id as string | undefined
    let stationId = claimStationId
    let role = session.user.app_metadata?.role as string | undefined

    // Fallback: look up from users table by auth id
    if (!stationId || !role) {
      const { data: su } = await supabase
        .from('users')
        .select('station_id, role')
        .eq('id', session.user.id)
        .maybeSingle()
      stationId = su?.station_id as string | undefined
      role = su?.role as string | undefined
    }

    // Secondary fallback: users by email (for invited staff pre-created by owner)
    if (!stationId || !role) {
      const userEmail = session.user.email ?? ''
      if (userEmail) {
        const { data: byEmail } = await supabase
          .from('users')
          .select('station_id, role')
          .eq('email', userEmail)
          .maybeSingle()
        if (byEmail) {
          stationId = byEmail.station_id as string | undefined
          role = byEmail.role as string | undefined
        }
      }
    }

    // Third fallback: accept a pending invitation.
    // Handles the case where an owner sent an OTP invite but the users row was
    // never created. The SECURITY DEFINER function stamps the users row from
    // the invitations table so the JWT hook picks it up on the next refresh.
    //
    // IMPORTANT: refreshSession() is called ONLY here, after a successful
    // invitation acceptance, so the JWT hook picks up the new station_id claim.
    // Do NOT call refreshSession() generically when claimStationId is missing —
    // that causes an infinite onAuthStateChange → loadSession loop and 429 errors.
    if (!stationId || !role) {
      const { data: invResult } = await supabase.rpc('accept_invitation')
      const accepted = invResult as { station_id?: string; error?: string } | null
      if (accepted?.station_id && !accepted.error) {
        stationId = accepted.station_id
        role = 'staff'
        // Refresh the JWT exactly once so the Postgres JWT hook can stamp
        // station_id into app_metadata, enabling RLS for this session.
        const { data: refreshed } = await supabase.auth.refreshSession()
        if (refreshed?.session?.user.app_metadata?.station_id) {
          stationId = refreshed.session.user.app_metadata.station_id as string
        }
      }
    }

    if (!stationId || !role) {
      // Authenticated but no station record — show setup error instead of silent loop
      setNoStation()
      return
    }

    const { data: stationRow } = await supabase
      .from('stations')
      .select('id, name, plan, owner_name, photo_url')
      .eq('id', stationId)
      .maybeSingle()

    if (!stationRow) {
      setNoStation()
      return
    }

    setAuth({
      user: session.user,
      stationId,
      role: role as Role,
      station: stationRow as Station,
    })
    setInitialized()

    // Realtime: keep station metadata (name, photo) in sync across devices
    if (stationChannelRef.current) {
      void supabase.removeChannel(stationChannelRef.current)
    }
    stationChannelRef.current = supabase
      .channel(`station-meta:${stationId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'stations', filter: `id=eq.${stationId}` },
        (payload) => { setStation(payload.new as Station) }
      )
      .subscribe()
  }, [setAuth, setStation, clearAuth, setInitialized, setNoStation])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      void loadSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          useAuthStore.getState().setPasswordRecovery(true)
          setInitialized()
          return
        }
        void loadSession(session)
      }
    )

    // Re-fetch station when app is foregrounded (mobile PWA loses WS while backgrounded)
    const handleVisibilityChange = () => {
      if (document.hidden) return
      const { stationId } = useAuthStore.getState()
      if (!stationId) return
      void supabase
        .from('stations')
        .select('id, name, plan, owner_name, photo_url')
        .eq('id', stationId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setStation(data as Station)
        })
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (stationChannelRef.current) {
        void supabase.removeChannel(stationChannelRef.current)
      }
    }
  }, [loadSession, setStation, setInitialized])
}

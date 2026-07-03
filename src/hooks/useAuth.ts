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
  const setInviteAcceptance = useAuthStore((s) => s.setInviteAcceptance)
  const setInviteExpired = useAuthStore((s) => s.setInviteExpired)
  const stationChannelRef = useRef<RealtimeChannel | null>(null)

  const loadSession = useCallback(async (session: Session | null) => {
    // Invite acceptance: the staff member clicked an invite link.
    // The flag is set in supabase.ts before the client processes the URL hash.
    if (sessionStorage.getItem('hydra_invite_pending') === '1') {
      sessionStorage.removeItem('hydra_invite_pending')
      if (!session) {
        // Token expired or already used — show a clear error instead of a broken form.
        setInviteExpired()
        return
      }
      // Valid session from the invite token → show set-password form.
      // Flag is cleared in LoginPage after updateUser() succeeds.
      setInviteAcceptance(true)
      setInitialized()
      return
    }

    // Guard: if LoginPage is already showing the invite setup form, don't let the
    // USER_UPDATED auth event (fired right after updateUser) race ahead and redirect
    // to the app before the success screen has finished.
    if (useAuthStore.getState().isInviteAcceptance) return

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
        // Do NOT call refreshSession() here — it rotates the refresh token and
        // TOKEN_REFRESHED fires a second loadSession. That second run hits
        // accept_invitation() again (idempotent), triggering a second refresh,
        // which uses the already-rotated token → 400 "Invalid Refresh Token".
        // station_id is already resolved above; the JWT hook will stamp the
        // claim on the next natural token rotation.
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
  }, [setAuth, setStation, clearAuth, setInitialized, setNoStation, setInviteAcceptance, setInviteExpired])

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

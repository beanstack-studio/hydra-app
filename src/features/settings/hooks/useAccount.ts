import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export function useAccount() {
  const { stationId, role } = useAuthStore()

  const updateName = useCallback(async (fullName: string): Promise<void> => {
    const { data: { user }, error } = await supabase.auth.updateUser({ data: { full_name: fullName } })
    if (error) throw new Error(error.message)
    if (user) {
      // Keep public.users in sync — auth metadata and the users table are not auto-synced
      const { error: dbErr } = await supabase
        .from('users')
        .update({ full_name: fullName })
        .eq('id', user.id)
      if (dbErr) throw new Error(dbErr.message)

      // Keep stations.owner_name in sync so invite emails show the correct owner name
      if (role === 'owner' && stationId) {
        const { error: stationErr } = await supabase
          .from('stations')
          .update({ owner_name: fullName })
          .eq('id', stationId)
        if (stationErr) throw new Error(stationErr.message)
      }
    }
  }, [stationId, role])

  const updateEmail = useCallback(async (newEmail: string): Promise<void> => {
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    if (error) throw new Error(error.message)
  }, [])

  const updatePassword = useCallback(async (newPassword: string): Promise<void> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw new Error(error.message)
  }, [])

  return { updateName, updateEmail, updatePassword }
}

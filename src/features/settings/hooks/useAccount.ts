import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export function useAccount() {
  const updateName = useCallback(async (fullName: string): Promise<void> => {
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } })
    if (error) throw new Error(error.message)
  }, [])

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

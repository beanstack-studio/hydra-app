import { createClient } from '@supabase/supabase-js'

// Detect invite acceptance before Supabase processes the URL hash.
// Must run before createClient so the flag is set when loadSession checks it.
if (typeof window !== 'undefined' && window.location.hash.includes('type=invite')) {
  sessionStorage.setItem('hydra_invite_pending', '1')
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

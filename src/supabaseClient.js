import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase env vars. Check .env.local for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.")
}

// Auth options are spelled out explicitly (not relying on supabase-js defaults)
// so a future SDK upgrade can't silently flip persistence off. persistSession
// + autoRefreshToken + localStorage means the session survives a closed tab
// and stays valid as long as the refresh token does.
//
// The refresh-token TTL itself is a server-side setting (Supabase Dashboard →
// Auth → Sessions). Default is 1 week; bump it to ~90 days so families don't
// get kicked out between active sessions.
//
// `storageKey` and `flowType` are intentionally NOT set so we keep the
// default values supabase-js used at every prior deploy — changing them
// would invalidate every currently-signed-in user the next time they open
// the app, which is the opposite of what we want.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
})

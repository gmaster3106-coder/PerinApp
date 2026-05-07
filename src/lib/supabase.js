// src/lib/supabase.js
// Supabase client singleton — import this everywhere, never createClient() twice.
//
// Required env vars (set in .env.local for dev, Vite env for prod):
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_ANON_KEY

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[Perin] Missing Supabase env vars. ' +
    'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env.local file.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist session in localStorage so users stay logged in across page reloads.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

/**
 * Sessionless anon Supabase client for **public** church content reads
 * (announcements, public prayer, public sermons, etc.).
 *
 * Why this exists:
 * The shared `supabase` auth client attaches the signed-in member JWT.
 * Several Vault RLS policies on announcements/prayer use
 * `EXISTS (SELECT 1 FROM public.users …)` for admin FOR ALL rules.
 * Evaluating those under `users` RLS can fail authenticated SELECTs
 * (e.g. infinite recursion / policy errors) even when anon public-read
 * policies would succeed — which is why visitor Prayer Wall works but
 * Member Home failed while signed in.
 *
 * Never use this client for privileged writes or member-private data.
 * Never put a service-role key here.
 */
export const supabasePublic: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

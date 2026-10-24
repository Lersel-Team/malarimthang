// Supabase client factory + guest (anonymous) session helper. Not wired into the game yet.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** null when env vars are missing (game then stays local-only). */
export function createSupabase(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Returns the user id, signing in anonymously only if there is no session. null on any failure (e.g. anonymous sign-ins disabled). */
export async function ensureGuestSession(client: SupabaseClient): Promise<string | null> {
  try {
    const { data } = await client.auth.getSession();
    if (data.session?.user) return data.session.user.id;
    const res = await client.auth.signInAnonymously();
    if (res.error) return null;
    return res.data.user?.id ?? null;
  } catch {
    return null;
  }
}

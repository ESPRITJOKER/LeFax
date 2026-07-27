import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Whether the app has real Supabase credentials wired up.
 * Until `.env.local` is populated (see `.env.example`), this is false and the
 * UI shows a "backend not configured" banner instead of crashing on network
 * calls that have nowhere valid to go.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Falls back to a syntactically valid but non-functional placeholder so the
// client can always be constructed — calls will simply fail over the network
// (handled gracefully by callers) rather than throwing at import time.
export const supabase = createClient<Database>(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

/**
 * Invoke an Edge Function with the signed-in user's access token explicitly
 * attached.
 *
 * Why this exists: with a session restored from storage on page reload,
 * supabase-js does not always propagate the user token to the functions
 * client, so `functions.invoke` falls back to sending the anon key. Functions
 * deployed with `verify_jwt = true` accept the anon key at the gateway but then
 * `auth.getUser()` finds no user and the function returns 401 "unauthorized".
 * Reading the session here and passing the Authorization header directly makes
 * the call always carry the real user token. `auth-otp` (pre-login) is the one
 * caller that should keep using `supabase.functions.invoke` with the anon key.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function invokeFn<T = any>(name: string, body?: Record<string, unknown>) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return supabase.functions.invoke<T>(name, {
    body,
    ...(session?.access_token ? { headers: { Authorization: `Bearer ${session.access_token}` } } : {}),
  });
}

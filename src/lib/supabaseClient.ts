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

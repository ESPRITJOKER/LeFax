// deno-lint-ignore-file no-explicit-any
// Shared Supabase clients for Edge Functions (Deno runtime).
// @ts-expect-error -- remote import, resolved by the Deno runtime at deploy time, not by the frontend's Node/tsc.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

declare const Deno: {
  env: { get(key: string): string | undefined };
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Admin client — bypasses RLS. Only ever used inside Edge Functions, never
 * shipped to the frontend. Used for ledger writes (FaxCoins, rankings,
 * admin_logs) that must be authoritative regardless of the caller's RLS
 * visibility.
 */
export function getServiceClient(): any {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Verifies the caller's JWT (from the Authorization header) and returns a
 * client scoped to that user, plus the decoded user. RLS applies normally
 * on this client — use it for anything that should respect the caller's own
 * row-level permissions.
 */
export async function getUserClientAndUser(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const client = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  return { client, user, error };
}

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import type { ProfileRow } from "./database.types";

interface AuthContextValue {
  session: Session | null;
  profile: ProfileRow | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Load the profile row, but keep the PREVIOUS object when nothing changed.
   *
   * Twenty `useEffect`s across the app list `profile` in their dependency
   * array. Every `setProfile(data)` handed them a brand-new object identity, so
   * any auth event — including the hourly `TOKEN_REFRESHED` and the
   * `SIGNED_IN` that fires when a tab regains focus — made every mounted screen
   * refetch all of its data. That is a large part of the "1 à 2 secondes"
   * (Correction N6, remark 5): work the user never asked for, racing the work
   * they did. Comparing before setting makes the identity stable.
   */
  async function loadProfile(userId: string) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) {
      console.error("[auth] loadProfile error:", error.message);
    }
    if (!data) return;
    const next = data as ProfileRow;
    setProfile((prev) => (prev && prev.id === next.id && prev.updated_at === next.updated_at ? prev : next));
  }

  async function refreshProfile() {
    if (session?.user?.id) await loadProfile(session.user.id);
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // No backend configured yet — skip network calls, render as logged-out.
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      // Await the profile load before clearing `loading` so route guards never
      // see "session present, profile still null" and fall open on a role gate.
      if (data.session?.user?.id) await loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      // Keep the same session object when only the token rotated: `session` is
      // in the context value, so a new object re-renders the entire tree for a
      // refresh the UI does not care about.
      setSession((prev) => (prev && newSession && prev.user?.id === newSession.user?.id && prev.access_token === newSession.access_token ? prev : newSession));

      if (!newSession?.user?.id) {
        setProfile(null);
        return;
      }
      // A token refresh does not change the profile row. Re-reading it on every
      // refresh was a request per hour per tab for data we already had.
      if (event === "TOKEN_REFRESHED") return;
      loadProfile(newSession.user.id);
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }

  const value = useMemo(
    () => ({ session, profile, loading, refreshProfile, signOut }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

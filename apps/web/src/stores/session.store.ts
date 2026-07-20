import type { AuthUser } from "@lefax/shared";
import { create } from "zustand";

interface SessionState {
  accessToken: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  setSession: (accessToken: string, user: AuthUser) => void;
  updateUser: (user: AuthUser) => void;
  setHydrated: () => void;
  clear: () => void;
}

/**
 * accessToken lives ONLY in memory (this store), never localStorage/sessionStorage
 * — NFR-05. It's lost on hard refresh by design; App.tsx silently re-derives it
 * from the httpOnly refresh cookie via POST /auth/refresh on boot.
 */
export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  user: null,
  hydrated: false,
  setSession: (accessToken, user) => set({ accessToken, user }),
  updateUser: (user) => set({ user }),
  setHydrated: () => set({ hydrated: true }),
  clear: () => set({ accessToken: null, user: null }),
}));

import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { Spinner } from "./ui";
import type { UserRole } from "../lib/database.types";

/**
 * Route guard. When Supabase isn't configured yet there is no way to
 * establish a real session, so we let the route render anyway (scaffold
 * mode) rather than trapping the developer behind a login wall they can
 * never pass — a BackendBanner communicates the missing wiring instead.
 */
export function ProtectedRoute({ roles, children }: { roles?: UserRole[]; children: ReactNode }) {
  const { session, profile, loading } = useAuth();

  if (!isSupabaseConfigured) return <>{children}</>;
  if (loading) return <Spinner />;
  if (!session) return <Navigate to="/login" replace />;
  if (roles && profile && !roles.includes(profile.role)) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { Spinner } from "./ui";
import type { UserRole } from "../lib/database.types";

// Where a role-mismatched user actually belongs. Must never point at a
// route that itself requires a `roles` the caller might not have — doing
// that (previously this was hardcoded to "/dashboard", which requires
// role "student") creates an infinite redirect loop for every non-student
// role: Navigate to /dashboard -> still wrong role -> Navigate again,
// forever. <Navigate> renders nothing and redirects from a useEffect, so
// the loop never trips React's "Maximum update depth" guard — it just
// spins silently and the page stays permanently blank with no console
// error at all.
function homeForRole(role: UserRole): string {
  switch (role) {
    case "admin":
    case "super_admin":
      return "/admin";
    case "teacher":
      return "/teacher";
    default:
      return "/dashboard";
  }
}

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
  // Role-gated route but the profile (which carries the role) hasn't resolved
  // yet — fail closed with a spinner rather than rendering protected content
  // for an as-yet-unknown role. This is transient (profile loads right after
  // sign-in); the earlier `roles && profile` form skipped the check entirely
  // whenever profile was null, letting any role through that window.
  if (roles && !profile) return <Spinner />;
  if (roles && profile && !roles.includes(profile.role)) return <Navigate to={homeForRole(profile.role)} replace />;

  return <>{children}</>;
}

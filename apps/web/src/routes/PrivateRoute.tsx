import type { Role } from "@lefax/shared";
import { Navigate } from "react-router-dom";
import { useSessionStore } from "../stores/session.store";

interface PrivateRouteProps {
  roles: Role[];
  children: React.ReactNode;
}

/**
 * UX-only gate — redirects so users don't land on a screen they can't use.
 * The real authorization boundary is server-side (fastify.requireRole),
 * per CDC NFR/S-03: the frontend never grants access on its own.
 */
export function PrivateRoute({ roles, children }: PrivateRouteProps) {
  const { user, hydrated } = useSessionStore();

  if (!hydrated) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}

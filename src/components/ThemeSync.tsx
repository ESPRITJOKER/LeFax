import { useEffect } from "react";
import { useAuth } from "../lib/auth";
import { applyTheme, readStoredTheme } from "../lib/theme";

/**
 * Keeps the painted theme in step with the signed-in user's `dark_mode`
 * preference. Mounted once, inside AuthProvider, above the router — so the
 * theme is applied on every route rather than only on the Profile screen, and
 * survives reloads and navigations.
 *
 * While auth is still resolving we leave whatever `main.tsx` pre-painted from
 * localStorage in place: flipping to light for the moment the profile is in
 * flight, then back to dark, is a visible flash on every load. Once auth has
 * settled with no user, light is correct — signed-out visitors (landing, login,
 * register) have never chosen a theme.
 */
export function ThemeSync() {
  const { profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      // Signed out: back to the default, and drop the previous user's choice so
      // the next visitor doesn't inherit it on the next load.
      if (readStoredTheme() !== "light") applyTheme("light");
      return;
    }
    applyTheme(profile.dark_mode ? "dark" : "light");
  }, [profile, loading]);

  return null;
}

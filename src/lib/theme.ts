/**
 * Theme application — the single place that decides whether the app paints in
 * light or dark.
 *
 * Dark mode is a per-user preference stored on `profiles.dark_mode` (CDC 6.12).
 * It used to be applied only by an effect inside the Profile screen, so a user
 * who had turned it on saw the light theme on every reload until they happened
 * to open /profile again — and signing out left the previous user's dark theme
 * on screen. Both are fixed by driving the attribute from one place
 * (`useThemeSync`, mounted once in main.tsx) and mirroring the choice into
 * localStorage.
 *
 * The localStorage mirror is what `readStoredTheme()` reads at module load, so
 * the very first paint after a reload is already the right theme instead of a
 * white flash. It is a cache of the server value, never the source of truth:
 * once the profile arrives, the profile wins.
 */

export type Theme = "light" | "dark";

const STORAGE_KEY = "lefax.theme";

/** Last theme this browser painted, if any. Safe in private mode / no storage. */
export function readStoredTheme(): Theme | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Paint the given theme and remember it. Writing `data-theme` on <html> is what
 * flips every `--color-*` token in index.css, so one call re-themes the whole
 * app — landing page, student shell, admin back-office, dialogs and all.
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage unavailable (private mode, blocked cookies) — the attribute is
       still set, we just can't pre-paint the next load. */
  }
}

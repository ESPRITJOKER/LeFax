/**
 * Account roles. "Directeur d'établissement" (CDC §2) is intentionally not
 * here — it's a read-only report reached via a one-time link, not a login.
 */
export const ROLES = ["student", "teacher", "admin"] as const;

export type Role = (typeof ROLES)[number];

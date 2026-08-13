/**
 * Phone normalization to E.164 for Cameroon (+237).
 *
 * The corrections doc flagged (note 5) that after signing up you couldn't log
 * back in and were forced to create a new account. Root cause: the number was
 * stored at sign-up in one shape and sent at login in another (spaces, missing
 * country code, a leading 0…), so Supabase Auth saw two different identifiers.
 * Normalizing on BOTH sign-up and login to the same canonical E.164 string
 * (`+237XXXXXXXXX`) makes the identifier stable across the two flows.
 */

/** Canonicalize a Cameroon phone number to E.164 (`+237XXXXXXXXX`).
 *  Strips spaces/punctuation, drops a leading 0, and ensures the +237 prefix.
 *  A bare local number (8–9 digits) gets +237 prepended. If the input already
 *  carries a different country code (starts with + and not 237), it is kept as
 *  typed (only whitespace/punctuation stripped) so non-CM numbers still work. */
export function normalizePhone(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const hadPlus = trimmed.startsWith("+");
  // Keep only digits.
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";

  // Explicit foreign country code (typed with +, not Cameroon) → keep as-is.
  if (hadPlus && !digits.startsWith("237")) return "+" + digits;

  // Already has the Cameroon country code.
  if (digits.startsWith("237")) return "+" + digits;

  // Local shorthand: drop a leading trunk 0, then prepend +237.
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  return "+237" + digits;
}

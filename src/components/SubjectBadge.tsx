import { subjectEmoji } from "../lib/icons";

/**
 * The subject tile students see: the subject's emoji on its own tinted square.
 *
 * The app had two visual languages for the same thing — student screens used
 * `subjectEmoji` (🧬 on a green square, per `SUBJECT_EMOJI`), while the admin
 * and teacher panels drew a flat vector via `subjectIcon` + `subjectColors`.
 * A subject should look like itself everywhere, so the admin panel now uses
 * this, the student one.
 *
 * Sizes stay per-call because the same badge appears at 58px on a subject
 * header and at 24px inside a pill; the emoji scales with the square.
 */
export function SubjectBadge({
  slug,
  size = 46,
  className = "",
}: {
  slug: string;
  /** Square side in px. */
  size?: number;
  className?: string;
}) {
  const se = subjectEmoji(slug);
  return (
    <div
      aria-hidden
      className={`rounded-xl flex items-center justify-center flex-none ${className}`}
      style={{
        width: size,
        height: size,
        background: se.bg,
        fontSize: Math.round(size * 0.48),
        lineHeight: 1,
      }}
    >
      {se.emoji}
    </div>
  );
}

/**
 * The same emoji with no tile, for pills and inline labels where a coloured
 * square would fight the pill's own background.
 */
export function SubjectGlyph({ slug, size = 13 }: { slug: string; size?: number }) {
  return (
    <span aria-hidden style={{ fontSize: size, lineHeight: 1 }}>
      {subjectEmoji(slug).emoji}
    </span>
  );
}

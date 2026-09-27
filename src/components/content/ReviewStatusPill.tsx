import { useI18n, type DictKey } from "../../lib/i18n";
import type { ReviewStatus } from "../../lib/database.types";

/**
 * The one place the review workflow is turned into a label + colour, so the
 * teacher panel, the admin editor and the review queue never disagree about
 * what "submitted" looks like.
 *
 * `published` is deliberately a separate signal, not a sixth status: a lesson
 * can be approved but held back, and the two facts matter independently.
 */
const STYLE: Record<ReviewStatus, { key: DictKey; fg: string; bg: string }> = {
  draft: { key: "status_draft", fg: "#647084", bg: "#eef1f5" },
  submitted: { key: "status_submitted", fg: "#0b5f96", bg: "#e8f4ff" },
  under_review: { key: "status_underReview", fg: "#a35b00", bg: "#fff4e0" },
  approved: { key: "status_approved", fg: "#15803d", bg: "#dcf5e3" },
  rejected: { key: "status_rejected", fg: "#b91c1c", bg: "#fee2e2" },
};

export function ReviewStatusPill({
  status,
  published,
  size = "md",
}: {
  status: ReviewStatus;
  published?: boolean;
  size?: "sm" | "md";
}) {
  const { t } = useI18n();
  const s = STYLE[status] ?? STYLE.draft;
  const pad = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]";
  return (
    <span className="inline-flex items-center gap-1.5 flex-none">
      <span className={`rounded-full font-bold ${pad}`} style={{ color: s.fg, background: s.bg }}>
        {t(s.key)}
      </span>
      {published && (
        <span className={`rounded-full font-bold ${pad}`} style={{ color: "#15803d", background: "#dcf5e3" }}>
          {t("status_published")}
        </span>
      )}
    </span>
  );
}

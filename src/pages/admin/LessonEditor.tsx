import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useI18n } from "../../lib/i18n";
import { LessonEditorCore } from "../../components/content/LessonEditorCore";
import { ReviewStatusPill } from "../../components/content/ReviewStatusPill";
import { invokeFn } from "../../lib/supabaseClient";
import type { LessonRow } from "../../lib/database.types";

/**
 * Admin lesson editor. The editing surface is shared with the teacher panel
 * (LessonEditorCore); what admins get on top is the authority bar:
 * publish/unpublish, and the verdict on a lesson a teacher submitted.
 *
 * Publication runs through the `admin` Edge Function (`review_lesson`) rather
 * than a direct table write, so the decision lands in admin_logs and the author
 * is notified in one server-side step. It is also the only path that may set
 * `lessons.published` at all (0018).
 */
export default function AdminLessonEditor() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { lessonId } = useParams<{ lessonId: string }>();

  if (!lessonId) return null;

  return (
    <LessonEditorCore
      lessonId={lessonId}
      canEdit
      onBack={() => navigate("/admin/content")}
      backLabel={t("admin_backToContent")}
      renderStatusBar={(lesson, reload) => <AdminReviewBar lesson={lesson} reload={reload} />}
    />
  );
}

function AdminReviewBar({ lesson, reload }: { lesson: LessonRow; reload: () => Promise<void> }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "reject" | "under_review", publish?: boolean) {
    if (decision === "reject" && !feedback.trim()) {
      setError(t("ar_feedback"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data, error: fnError } = await invokeFn("admin", {
        action: "review_lesson",
        lesson_id: lesson.id,
        decision,
        feedback: feedback.trim() || undefined,
        publish,
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(String(data.error));
      setFeedback("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("admin_saveError"));
    }
    setBusy(false);
  }

  const awaitingReview = lesson.review_status === "submitted" || lesson.review_status === "under_review";

  return (
    <div className="mb-4 bg-white border border-border rounded-2xl px-4 py-3.5 flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <ReviewStatusPill status={lesson.review_status} published={lesson.published} />
        <span className="text-[12px] text-muted flex-1 min-w-[140px]">{lesson.published ? t("admin_publishedHint") : t("admin_draftHint")}</span>
        {lesson.published ? (
          <button onClick={() => decide("approve", false)} disabled={busy} className="border-none px-4 py-2 rounded-xl text-[13px] font-bold text-white bg-ink-700 disabled:opacity-60">
            {busy ? t("admin_uploading") : t("admin_unpublish")}
          </button>
        ) : (
          <button onClick={() => decide("approve", true)} disabled={busy} className="border-none px-4 py-2 rounded-xl text-[13px] font-bold text-white bg-success-600 disabled:opacity-60">
            {busy ? t("admin_uploading") : lesson.review_status === "approved" ? t("admin_publish") : t("ar_approveAndPublish")}
          </button>
        )}
      </div>

      {lesson.review_feedback && (
        <div className="rounded-xl bg-ink-50 border border-ink-100 px-3 py-2 text-[12px] text-ink-800">
          <span className="font-bold">{t("tc_feedback")}: </span>
          {lesson.review_feedback}
        </div>
      )}

      {awaitingReview && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-muted">{t("ar_feedback")}</span>
            <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} className="px-3 py-2 rounded-lg border-[1.5px] border-ink-300 text-[12.5px] resize-y" />
          </label>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => decide("approve", false)} disabled={busy} className="border-none px-4 py-2 rounded-xl text-[12.5px] font-bold bg-brand-600 text-white disabled:opacity-60">
              {t("ar_approve")}
            </button>
            <button onClick={() => decide("reject")} disabled={busy} className="border-none px-4 py-2 rounded-xl text-[12.5px] font-bold bg-danger-600 text-white disabled:opacity-60">
              {t("ar_requestChanges")}
            </button>
            {lesson.review_status === "submitted" && (
              <button onClick={() => decide("under_review")} disabled={busy} className="border border-border bg-white px-4 py-2 rounded-xl text-[12.5px] font-bold text-ink-900 disabled:opacity-60">
                {t("ar_markUnderReview")}
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="text-[12px] font-semibold text-danger-600">
          {error}
        </div>
      )}
    </div>
  );
}

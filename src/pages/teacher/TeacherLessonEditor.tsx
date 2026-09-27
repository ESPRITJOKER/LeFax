import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { LessonEditorCore } from "../../components/content/LessonEditorCore";
import { ReviewStatusPill } from "../../components/content/ReviewStatusPill";
import { isTeacherEditable, submitLessonForReview } from "../../lib/teacher";
import type { LessonRow } from "../../lib/database.types";

/**
 * Teacher lesson editor — the same editing surface as the admin one
 * (LessonEditorCore), with the teacher's own bar on top: review status, the
 * reviewer's feedback when something came back, and "submit for review".
 *
 * There is deliberately no publish control: publication belongs to an admin
 * (FR-10), and the database refuses it for a teacher even if the UI asked
 * (0018 — `lessons_update_staff` + `guard_lesson_teacher_fields`).
 */
export default function TeacherLessonEditor() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { lessonId } = useParams<{ lessonId: string }>();
  const { profile } = useAuth();

  if (!lessonId) return null;

  return (
    <LessonEditorCore
      lessonId={lessonId}
      // Locked as soon as the lesson leaves the teacher's hands — mirrors
      // `lesson_is_teacher_editable` in 0018, which is what actually decides.
      canEdit={(lesson) => isTeacherEditable(lesson) && lesson.author_id === profile?.id}
      onBack={() => navigate("/teacher/content")}
      backLabel={t("admin_backToContent")}
      renderStatusBar={(lesson, reload) => <TeacherReviewBar lesson={lesson} reload={reload} ownerId={profile?.id ?? null} />}
    />
  );
}

function TeacherReviewBar({ lesson, reload, ownerId }: { lesson: LessonRow; reload: () => Promise<void>; ownerId: string | null }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editable = isTeacherEditable(lesson) && lesson.author_id === ownerId;

  async function submit() {
    if (!window.confirm(t("tc_confirmSubmit"))) return;
    setBusy(true);
    setError(null);
    const res = await submitLessonForReview(lesson.id);
    if (res.error) setError(res.error);
    else await reload();
    setBusy(false);
  }

  return (
    <div className="mb-4 bg-white border border-border rounded-2xl px-4 py-3.5 flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <ReviewStatusPill status={lesson.review_status} published={lesson.published} />
        <span className="text-[12px] text-muted flex-1 min-w-[160px]">
          {editable
            ? t("admin_draftHint")
            : lesson.review_status === "approved"
              ? t("tc_lockedApproved")
              : t("tc_lockedSubmitted")}
        </span>
        {editable && (
          <button onClick={submit} disabled={busy} className="border-none px-4 py-2 rounded-xl text-[13px] font-bold bg-brand-600 text-white disabled:opacity-60">
            {busy ? t("tc_submitting") : t("tc_submitForReview")}
          </button>
        )}
      </div>

      {lesson.review_feedback && (
        <div className="rounded-xl bg-danger-600/5 border border-danger-600/30 px-3 py-2 text-[12px] text-ink-800">
          <span className="font-bold text-danger-600">{t("tc_feedback")}: </span>
          {lesson.review_feedback}
        </div>
      )}

      {!editable && (
        <div className="flex items-center gap-2 text-[11.5px] text-muted">
          <Icon name="lock" size={13} />
          {lesson.review_status === "approved" ? t("tc_lockedApproved") : t("tc_lockedSubmitted")}
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

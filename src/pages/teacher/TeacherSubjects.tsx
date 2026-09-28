import { Link } from "react-router-dom";
import { Icon } from "../../lib/icons";
import { SubjectBadge } from "../../components/SubjectBadge";
import { Spinner } from "../../components/ui";
import { StateNotice } from "../../components/StateNotice";
import { useI18n } from "../../lib/i18n";
import { useMySubjects } from "../../lib/teacher";

/**
 * "My subjects" — the teacher's workspace list, and the only entry point into
 * authoring. A subject appears here exactly when a super_admin holds an active
 * grant for it (`teacher_subjects`, 0018); there is no way to reach a subject
 * that isn't listed, because both the content tree and the database filter on
 * the same grant.
 */
export default function TeacherSubjects() {
  const { t, lang } = useI18n();
  const { subjects, loading, error, reload } = useMySubjects();

  if (loading) return <Spinner />;
  if (error) return <StateNotice error={error} emptyLabel={t("td_noSubjects")} errorLabel={t("common_error")} onRetry={reload} />;

  if (subjects.length === 0) {
    return (
      <div className="bg-white border border-border rounded-2xl p-6 text-center max-w-[520px]">
        <div className="w-11 h-11 rounded-full bg-ink-100 text-ink-700 flex items-center justify-center mx-auto mb-3">
          <Icon name="book" size={20} />
        </div>
        <div className="font-serif font-bold text-[17px] text-ink-950 mb-1.5">{t("td_noSubjects")}</div>
        <div className="text-[12.5px] text-muted leading-relaxed">{t("td_noSubjectsHint")}</div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 max-w-[980px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))" }}>
      {subjects.map((s) => {
        return (
          <div key={s.id} className="bg-white border border-border rounded-2xl p-5 flex flex-col">
            <div className="flex items-center gap-3 mb-3.5">
              {/* The same badge students see for this subject. */}
              <SubjectBadge slug={s.slug} size={40} />
              <div className="min-w-0">
                <div className="text-[14px] font-bold text-ink-900 truncate">{lang === "fr" ? s.name_fr : s.name_en}</div>
                <div className="text-[11.5px] text-muted">
                  {s.chapterCount} {t("ts_chapters")} · {s.myLessons} {t("ts_myLessons")}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <Metric label={t("td_drafts")} value={s.myDrafts} />
              <Metric label={t("td_awaitingReview")} value={s.mySubmitted} />
              <Metric label={t("td_approved")} value={s.myApproved} tone="success" />
              <Metric label={t("td_rejected")} value={s.myRejected} tone={s.myRejected > 0 ? "danger" : undefined} />
            </div>

            {s.assignment?.created_at && (
              <div className="text-[11px] text-muted mb-3">
                {t("ts_assignedOn")} {new Date(s.assignment.created_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB")}
              </div>
            )}

            <div className="flex-1" />
            <div className="flex gap-2">
              <Link
                to={`/teacher/content?subject=${s.id}`}
                className="flex-1 text-center border-none px-3.5 py-2.5 rounded-xl text-[12.5px] font-bold bg-brand-600 text-white"
              >
                {t("ts_open")}
              </Link>
              <Link
                to={`/teacher/question-bank?subject=${s.id}`}
                className="flex-1 text-center border border-border bg-white px-3.5 py-2.5 rounded-xl text-[12.5px] font-bold text-ink-900"
              >
                {t("teacher_questionBank")}
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" }) {
  const color = tone === "success" ? "text-success-600" : tone === "danger" ? "text-danger-600" : "text-ink-900";
  return (
    <div className="rounded-xl bg-ink-50 border border-ink-100 px-2.5 py-2">
      <div className="text-[10.5px] font-semibold text-muted leading-tight mb-0.5">{label}</div>
      <div className={`text-[17px] font-extrabold ${color}`}>{value}</div>
    </div>
  );
}

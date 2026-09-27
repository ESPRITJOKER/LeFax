import { Link } from "react-router-dom";
import { Spinner } from "../../components/ui";
import { StateNotice } from "../../components/StateNotice";
import { ProgressBar } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useTeacherPerformance } from "../../lib/teacher";

/**
 * Student performance on the teacher's own content.
 *
 * Aggregated server-side (`teacher` Edge Function, `performance_summary`) over
 * quizzes attached to lessons the caller authored inside their assigned
 * subjects. Nothing here is synthesised: a quiz with no attempts reports 0
 * attempts, and a failed request says so — previously both branches of a
 * ternary rendered the same string, so "no data" and "request failed" were
 * indistinguishable (audited Defect 4).
 */
export default function TeacherPerformance() {
  const { t, lang } = useI18n();
  const { quizzes, loading, error, reload } = useTeacherPerformance();

  if (loading) return <Spinner />;
  if (error || quizzes.length === 0) {
    return <StateNotice error={error} emptyLabel={t("tp_empty")} errorLabel={t("tp_failed")} onRetry={reload} />;
  }

  const withAttempts = quizzes.filter((q) => q.attempts > 0);
  const totalAttempts = withAttempts.reduce((sum, q) => sum + q.attempts, 0);
  const overall = withAttempts.length
    ? Math.round(withAttempts.reduce((sum, q) => sum + q.avgScore * q.attempts, 0) / Math.max(1, totalAttempts))
    : 0;

  return (
    <div className="flex flex-col gap-4 max-w-[860px]">
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <Tile label={t("td_quizzes")} value={String(quizzes.length)} />
        <Tile label={t("tp_attempts")} value={String(totalAttempts)} />
        <Tile label={t("tp_avg")} value={`${overall}%`} tone={overall >= 50 ? "success" : "danger"} />
      </div>

      <div className="flex flex-col gap-2.5">
        {quizzes.map((q) => (
          <div key={q.quizId} className="bg-white border border-border rounded-2xl px-[18px] py-3.5">
            <div className="flex items-center gap-3.5 flex-wrap mb-2">
              <div className="flex-1 min-w-[160px]">
                <Link to={`/teacher/content/lesson/${q.lessonId}`} className="text-[13px] font-bold text-ink-900 hover:text-brand-600">
                  {lang === "fr" ? q.titleFr : q.titleEn || q.titleFr}
                </Link>
                <div className="text-[11.5px] text-muted truncate">{lang === "fr" ? q.lessonTitleFr : q.lessonTitleEn}</div>
              </div>
              <div className="text-[11.5px] text-muted">
                {q.attempts} {t("tp_attempts")}
              </div>
              <div className={`text-sm font-extrabold ${q.attempts === 0 ? "text-muted" : q.avgScore >= 50 ? "text-success-600" : "text-danger-600"}`}>
                {q.attempts === 0 ? "—" : `${q.avgScore}%`}
              </div>
            </div>
            {q.attempts > 0 && (
              <>
                <ProgressBar pct={q.avgScore} color={q.avgScore >= 50 ? "success" : "ochre"} />
                <div className="flex gap-4 mt-1.5 text-[11px] text-muted">
                  <span>
                    {t("tp_best")}: <strong className="text-ink-800">{q.bestScore}%</strong>
                  </span>
                  <span>
                    {t("tp_worst")}: <strong className="text-ink-800">{q.worstScore}%</strong>
                  </span>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  const color = tone === "success" ? "text-success-600" : tone === "danger" ? "text-danger-600" : "text-ink-950";
  return (
    <div className="bg-white border border-border rounded-2xl p-[18px]">
      <div className="text-xs font-semibold text-muted mb-1.5">{label}</div>
      <div className={`text-[24px] font-extrabold ${color}`}>{value}</div>
    </div>
  );
}

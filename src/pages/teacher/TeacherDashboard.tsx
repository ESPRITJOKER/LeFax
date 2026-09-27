import { Link } from "react-router-dom";
import { Icon, type IconName } from "../../lib/icons";
import { Spinner } from "../../components/ui";
import { StateNotice } from "../../components/StateNotice";
import { ReviewStatusPill } from "../../components/content/ReviewStatusPill";
import { useI18n } from "../../lib/i18n";
import { useTeacherSummary } from "../../lib/teacher";

/**
 * Teacher dashboard: the state of the teacher's own work, nothing invented.
 *
 * Every number comes from one server-side aggregate (`teacher` Edge Function,
 * `dashboard_summary`) scoped to the caller's assigned subjects and authored
 * rows — the audited version issued two `count` queries and showed two tiles.
 */
export default function TeacherDashboard() {
  const { t, lang } = useI18n();
  const { summary, loading, error, reload } = useTeacherSummary();

  if (loading) return <Spinner />;
  if (error || !summary) {
    return <StateNotice error={error ?? "no data"} emptyLabel={t("tp_empty")} errorLabel={t("common_error")} onRetry={reload} />;
  }

  // A teacher with no grant cannot author anything — say so plainly instead of
  // showing a wall of zeroes.
  if (summary.subjects === 0) {
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

  const l = summary.lessons;
  const tasks: { key: string; label: string; to: string; count: number }[] = [
    { key: "rejected", label: t("td_taskFixRejected"), to: "/teacher/content", count: l.rejected },
    { key: "drafts", label: t("td_taskFinishDrafts"), to: "/teacher/content", count: l.draft },
    { key: "qcm", label: t("td_taskReviewQcm"), to: "/teacher/ai-assist", count: summary.approvals.pending },
  ].filter((x) => x.count > 0);

  return (
    <div className="flex flex-col gap-5 max-w-[980px]">
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <StatCard icon="book" label={t("td_assignedSubjects")} value={summary.subjects} to="/teacher/subjects" />
        <StatCard icon="quill" label={t("td_lessons")} value={l.total} to="/teacher/content" />
        <StatCard icon="edit" label={t("td_drafts")} value={l.draft} to="/teacher/content" />
        <StatCard icon="clipboard" label={t("td_awaitingReview")} value={l.submitted} />
        <StatCard icon="check" label={t("td_approved")} value={l.approved} tone="success" />
        <StatCard icon="close" label={t("td_rejected")} value={l.rejected} tone={l.rejected > 0 ? "danger" : undefined} to="/teacher/content" />
        <StatCard icon="unlock" label={t("td_published")} value={l.published} tone="success" />
        <StatCard icon="flask" label={t("td_quizzes")} value={summary.quizzes} to="/teacher/question-bank" />
        <StatCard icon="target" label={t("td_questions")} value={summary.questions} to="/teacher/question-bank" />
        <StatCard icon="wand" label={t("td_pendingQcm")} value={summary.approvals.pending} to="/teacher/ai-assist" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pending tasks */}
        <div className="bg-white border border-border rounded-2xl p-5">
          <div className="text-[13.5px] font-bold text-ink-900 mb-3">{t("td_pendingTasks")}</div>
          {tasks.length === 0 ? (
            <div className="text-[12.5px] text-muted">{t("td_noTasks")}</div>
          ) : (
            <ul className="flex flex-col gap-2">
              {tasks.map((task) => (
                <li key={task.key}>
                  <Link to={task.to} className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2.5 hover:bg-ink-50">
                    <span className="w-6 h-6 rounded-full bg-brand-600/10 text-brand-600 text-[11px] font-bold flex items-center justify-center flex-none">
                      {task.count}
                    </span>
                    <span className="text-[12.5px] text-ink-900 flex-1">{task.label}</span>
                    <Icon name="chevright" size={14} className="text-muted flex-none" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent activity */}
        <div className="bg-white border border-border rounded-2xl p-5">
          <div className="text-[13.5px] font-bold text-ink-900 mb-3">{t("td_recent")}</div>
          {summary.recent.length === 0 ? (
            <div className="text-[12.5px] text-muted">{t("tc_noChapters")}</div>
          ) : (
            <ul className="flex flex-col gap-2">
              {summary.recent.map((r) => (
                <li key={r.id}>
                  <Link to={`/teacher/content/lesson/${r.id}`} className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2.5 hover:bg-ink-50">
                    <Icon name="book" size={14} className="text-muted flex-none" />
                    <span className="text-[12.5px] text-ink-900 flex-1 truncate">{lang === "fr" ? r.titleFr : r.titleEn || r.titleFr}</span>
                    <ReviewStatusPill status={r.reviewStatus} published={r.published} size="sm" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  to,
  tone,
}: {
  icon: IconName;
  label: string;
  value: number;
  to?: string;
  tone?: "success" | "danger";
}) {
  const color = tone === "success" ? "text-success-600" : tone === "danger" ? "text-danger-600" : "text-ink-950";
  const body = (
    <div className="bg-white border border-border rounded-2xl p-[18px] h-full">
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center bg-ink-100 text-ink-700 flex-none">
          <Icon name={icon} size={17} />
        </div>
        <div className="text-xs font-semibold text-muted leading-snug">{label}</div>
      </div>
      <div className={`text-[26px] font-extrabold ${color}`}>{value}</div>
    </div>
  );
  return to ? (
    <Link to={to} className="block hover:opacity-90">
      {body}
    </Link>
  ) : (
    body
  );
}

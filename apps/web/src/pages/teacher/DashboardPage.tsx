import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type QaQuestionDto, type TeacherContentItemDto, type TeacherLessonOptionDto } from "../../lib/api-client";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-yellow-100 text-on-secondary-fixed-variant",
  in_review: "bg-surface-container text-on-surface-variant",
  approved: "bg-green-100 text-success-green",
  rejected: "bg-error-red/10 text-error-red",
};

/** Ported from stitch_lefax_course_exam_prep/teacher_content_dashboard (WEB-T01). Every number below is real. */
export function TeacherDashboardPage() {
  const { t, i18n } = useTranslation();
  const typeLabels: Record<string, string> = {
    lesson_card: t("teacherDashboard.type.lessonCard"),
    qcm: t("teacherDashboard.type.qcm"),
    past_paper: t("teacherDashboard.type.pastPaper"),
  };
  const statusLabels: Record<string, string> = {
    draft: t("teacherContent.status.draft"),
    in_review: t("teacherContent.status.inReview"),
    approved: t("teacherContent.status.approved"),
    rejected: t("teacherContent.status.rejected"),
  };
  const navigate = useNavigate();
  const [items, setItems] = useState<TeacherContentItemDto[]>([]);
  const [lessons, setLessons] = useState<TeacherLessonOptionDto[]>([]);
  const [unanswered, setUnanswered] = useState<QaQuestionDto[]>([]);
  const [search, setSearch] = useState("");
  const [draftLessonId, setDraftLessonId] = useState("");
  const [draftText, setDraftText] = useState("");
  const [draftSaved, setDraftSaved] = useState(false);

  function refresh() {
    api.teacherContent().then((res) => setItems(res.items));
    api.teacherQaQuestions("unanswered").then((res) => setUnanswered(res.questions));
  }

  useEffect(() => {
    refresh();
    api.teacherLessonsList().then((res) => setLessons(res.lessons));
  }, []);

  async function saveDraft() {
    if (!draftLessonId || !draftText.trim()) return;
    await api.createLessonCard({ lessonId: draftLessonId, cardType: "text", textContent: draftText.trim() });
    setDraftText("");
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
    refresh();
  }

  const filtered = search
    ? items.filter((i) => JSON.stringify(i).toLowerCase().includes(search.toLowerCase()))
    : items;
  const recent = filtered.slice(0, 5);

  const totalContent = items.length;
  const publishedQcms = items.filter((i) => i.type === "qcm" && i.status === "approved").length;
  const draftsPending = items.filter((i) => i.status === "draft" || i.status === "in_review").length;

  const byType: Record<string, number> = { lesson_card: 0, qcm: 0, past_paper: 0 };
  for (const item of items) byType[item.type] = (byType[item.type] ?? 0) + 1;
  const distTotal = Math.max(1, totalContent);
  const distSegments = [
    { key: "lesson_card", label: t("teacherDashboard.distLessonCards"), color: "bg-excellence-blue", count: byType.lesson_card ?? 0 },
    { key: "qcm", label: t("teacherDashboard.distQcms"), color: "bg-action-blue", count: byType.qcm ?? 0 },
    { key: "past_paper", label: t("teacherDashboard.distPastPapers"), color: "bg-secondary-container", count: byType.past_paper ?? 0 },
  ];

  function titleOf(item: TeacherContentItemDto) {
    return String(item.text_content ?? item.question ?? item.title ?? t("lessonEditor.untitled")).slice(0, 60);
  }
  function editRoute(item: TeacherContentItemDto) {
    return item.type === "lesson_card" ? "/teacher/lessons" : item.type === "qcm" ? "/teacher/qcms" : "/teacher/past-papers";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-xl gap-lg flex-wrap">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-excellence-blue">{t("teacherDashboard.title")}</h1>
          <p className="font-label-md text-label-md text-text-secondary">{t("teacherDashboard.subtitle")}</p>
        </div>
        <div className="flex items-center gap-lg">
          <div className="relative w-80">
            <MaterialIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("teacherDashboard.searchPlaceholder")}
              className="w-full pl-10 pr-4 py-2 bg-surface-container rounded-xl border-none focus:ring-2 focus:ring-excellence-blue text-body-md font-body-md"
            />
          </div>
          <button
            type="button"
            onClick={() => navigate("/teacher/lessons")}
            className="bg-excellence-blue text-white px-lg py-sm rounded-xl font-label-lg text-label-lg flex items-center gap-xs"
          >
            <MaterialIcon name="add" className="text-[16px]" />
            {t("teacherDashboard.createContent")}
          </button>
        </div>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter mb-xl">
        <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant flex flex-col gap-sm">
          <MaterialIcon name="library_books" className="text-action-blue bg-surface-container p-2 rounded-lg w-fit" />
          <span className="font-label-lg text-label-lg text-text-secondary">{t("teacherDashboard.totalContent")}</span>
          <span className="font-display-lg text-display-lg text-excellence-blue">{totalContent}</span>
        </div>
        <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant flex flex-col gap-sm">
          <MaterialIcon name="task_alt" className="text-secondary bg-surface-container p-2 rounded-lg w-fit" />
          <span className="font-label-lg text-label-lg text-text-secondary">{t("teacherDashboard.publishedQcms")}</span>
          <span className="font-display-lg text-display-lg text-excellence-blue">{publishedQcms}</span>
        </div>
        <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant flex flex-col gap-sm">
          <MaterialIcon name="chat_bubble" className="text-achievement-gold bg-surface-container p-2 rounded-lg w-fit" />
          <span className="font-label-lg text-label-lg text-text-secondary">{t("teacherDashboard.unansweredQuestions")}</span>
          <span className="font-display-lg text-display-lg text-excellence-blue">{unanswered.length}</span>
        </div>
        <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant flex flex-col gap-sm">
          <MaterialIcon name="edit_note" className="text-error-red bg-surface-container p-2 rounded-lg w-fit" />
          <span className="font-label-lg text-label-lg text-text-secondary">{t("teacherDashboard.draftsPending")}</span>
          <span className="font-display-lg text-display-lg text-excellence-blue">{draftsPending}</span>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-xl mb-xl">
        <section className="lg:col-span-2 space-y-md">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-md text-headline-md text-excellence-blue">{t("teacherDashboard.recentContent")}</h2>
            <button type="button" onClick={() => navigate("/teacher/lessons")} className="text-action-blue font-label-lg text-label-lg hover:underline">
              {t("teacherDashboard.viewAll")}
            </button>
          </div>
          {recent.length === 0 ? (
            <p className="font-body-sm text-body-sm text-text-secondary">{t("onboarding.comingSoon")}</p>
          ) : (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container border-b border-outline-variant">
                    <th className="px-md py-4 font-label-lg text-label-lg text-text-secondary">{t("teacherDashboard.colTitle")}</th>
                    <th className="px-md py-4 font-label-lg text-label-lg text-text-secondary">{t("teacherDashboard.colType")}</th>
                    <th className="px-md py-4 font-label-lg text-label-lg text-text-secondary">{t("teacherDashboard.colStatus")}</th>
                    <th className="px-md py-4 font-label-lg text-label-lg text-text-secondary">{t("teacherDashboard.colDate")}</th>
                    <th className="px-md py-4 font-label-lg text-label-lg text-text-secondary">{t("teacherDashboard.colAction")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {recent.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-md py-4 font-body-md text-body-md font-medium">{titleOf(item)}</td>
                      <td className="px-md py-4 text-body-sm text-body-sm text-text-secondary">{typeLabels[item.type]}</td>
                      <td className="px-md py-4">
                        <span className={`px-2 py-1 rounded-full text-label-md font-label-md ${STATUS_STYLES[item.status]}`}>
                          {statusLabels[item.status]}
                        </span>
                      </td>
                      <td className="px-md py-4 text-body-sm text-body-sm text-text-secondary">
                        {new Date(item.created_at).toLocaleDateString(i18n.language.startsWith("fr") ? "fr-FR" : "en-US")}
                      </td>
                      <td className="px-md py-4">
                        <button type="button" onClick={() => navigate(editRoute(item))}>
                          <MaterialIcon name="edit" className="text-text-secondary hover:text-excellence-blue transition-colors" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="space-y-xl">
          <div className="bg-excellence-blue text-white p-xl rounded-xl shadow-lg relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />
            <h3 className="font-headline-md text-headline-md mb-md">{t("teacherDashboard.quickDraft")}</h3>
            <p className="font-body-sm text-body-sm opacity-80 mb-lg">{t("teacherDashboard.quickDraftBody")}</p>
            <div className="space-y-md">
              <select
                value={draftLessonId}
                onChange={(e) => setDraftLessonId(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-secondary-container [&>option]:text-text-primary"
              >
                <option value="">{t("teacherDashboard.selectLesson")}</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.chapters?.subjects?.name} → {l.title}
                  </option>
                ))}
              </select>
              <input
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder={t("teacherDashboard.draftPlaceholder")}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg placeholder-white/50 text-white focus:outline-none focus:ring-2 focus:ring-secondary-container"
              />
              <button
                type="button"
                onClick={saveDraft}
                className="w-full bg-secondary-container text-on-secondary-container py-3 rounded-lg font-label-lg text-label-lg hover:brightness-105 transition-all"
              >
                {draftSaved ? t("teacherDashboard.draftSaved") : t("teacherDashboard.saveDraft")}
              </button>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant space-y-lg">
            <h3 className="font-headline-md text-headline-md text-excellence-blue">{t("teacherDashboard.recentFeedback")}</h3>
            {unanswered.length === 0 ? (
              <p className="font-body-sm text-body-sm text-text-secondary">{t("teacherDashboard.noQuestions")}</p>
            ) : (
              <div className="space-y-md">
                {unanswered.slice(0, 2).map((q) => (
                  <div key={q.id} className="p-md bg-surface-container rounded-lg border-l-4 border-action-blue">
                    <div className="flex items-center gap-2 mb-1">
                      <MaterialIcon name="help" filled className="text-sm text-action-blue" />
                      <span className="font-label-md text-label-md text-text-primary">{q.title}</span>
                    </div>
                    <p className="text-body-sm text-body-sm italic text-text-secondary">{q.body.slice(0, 100)}</p>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => navigate("/teacher/feedback")}
              className="w-full py-2 text-action-blue font-label-lg text-label-lg hover:underline transition-all"
            >
              {t("teacherDashboard.respondToStudents")}
            </button>
          </div>
        </aside>
      </div>

      <section className="bg-white rounded-xl border border-outline-variant p-xl">
        <div className="mb-xl">
          <h2 className="font-headline-md text-headline-md text-excellence-blue">{t("teacherDashboard.contentDistribution")}</h2>
          <p className="font-body-sm text-body-sm text-text-secondary">{t("teacherDashboard.contentDistributionSubtitle")}</p>
        </div>
        {totalContent === 0 ? (
          <p className="font-body-sm text-body-sm text-text-secondary">{t("onboarding.comingSoon")}</p>
        ) : (
          <>
            <div className="flex items-center gap-1 h-4 rounded-full bg-surface-container overflow-hidden">
              {distSegments.map(
                (seg) =>
                  seg.count > 0 && (
                    <div
                      key={seg.key}
                      className={`h-full ${seg.color}`}
                      style={{ width: `${(seg.count / distTotal) * 100}%` }}
                      title={`${seg.label} - ${seg.count}`}
                    />
                  )
              )}
            </div>
            <div className="mt-lg flex flex-wrap gap-xl">
              {distSegments.map((seg) => (
                <div key={seg.key} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${seg.color}`} />
                  <span className="text-label-md font-label-md text-text-primary">
                    {seg.label} ({seg.count})
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

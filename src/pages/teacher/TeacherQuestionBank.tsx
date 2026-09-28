import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../../lib/icons";
import { SubjectGlyph } from "../../components/SubjectBadge";
import { Pill, Spinner } from "../../components/ui";
import { StateNotice } from "../../components/StateNotice";
import { ReviewStatusPill } from "../../components/content/ReviewStatusPill";
import { LessonQuizPanel } from "../../components/content/LessonQuizPanel";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { useMySubjects, isTeacherEditable } from "../../lib/teacher";
import type { ReviewStatus } from "../../lib/database.types";

type LessonWithQuiz = {
  id: string;
  title_fr: string;
  title_en: string;
  published: boolean;
  review_status: ReviewStatus;
  chapter_id: string;
  quizId: string | null;
  questionCount: number;
};

/**
 * Quiz & question bank: every quiz the teacher owns, per subject, with the
 * question editor inline.
 *
 * The editor itself is the shared `LessonQuizPanel` (also used by the admin
 * lesson editor), so question authoring — bilingual prompt and explanation,
 * difficulty, any number of options with exactly one correct, reordering, and
 * the maths/chemistry insert tools — behaves identically for both roles. A quiz
 * belongs to a lesson, so the bank is organised by lesson; questions are only
 * editable while the parent lesson is still the teacher's draft, which is what
 * stops the approval gate being bypassed (0018).
 */
export default function TeacherQuestionBank() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const { subjects, loading: subjectsLoading, error: subjectsError, reload: reloadSubjects } = useMySubjects();

  const subjectId = params.get("subject") ?? subjects[0]?.id ?? "";
  const [lessons, setLessons] = useState<LessonWithQuiz[]>([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !subjectId || !profile) return;
    setLoading(true);
    const { data: chapters } = await supabase.from("chapters").select("id").eq("subject_id", subjectId);
    const chapterIds = (chapters ?? []).map((c) => c.id);
    if (!chapterIds.length) {
      setLessons([]);
      setLoading(false);
      return;
    }
    const { data: lessonRows } = await supabase
      .from("lessons")
      .select("id, title_fr, title_en, published, review_status, chapter_id")
      .eq("author_id", profile.id)
      .in("chapter_id", chapterIds)
      .order("position");

    const ids = (lessonRows ?? []).map((l) => l.id);
    const { data: quizRows } = ids.length ? await supabase.from("quizzes").select("id, lesson_id").in("lesson_id", ids) : { data: [] };
    const quizIds = (quizRows ?? []).map((q) => q.id);
    const { data: questionRows } = quizIds.length ? await supabase.from("questions").select("id, quiz_id").in("quiz_id", quizIds) : { data: [] };

    setLessons(
      (lessonRows ?? []).map((l) => {
        const quiz = (quizRows ?? []).find((q) => q.lesson_id === l.id);
        return {
          ...l,
          quizId: quiz?.id ?? null,
          questionCount: quiz ? (questionRows ?? []).filter((q) => q.quiz_id === quiz.id).length : 0,
        } as LessonWithQuiz;
      })
    );
    setLoading(false);
  }, [subjectId, profile]);

  useEffect(() => {
    load();
  }, [load]);

  if (subjectsLoading) return <Spinner />;
  if (subjectsError || subjects.length === 0) {
    return <StateNotice error={subjectsError} emptyLabel={t("td_noSubjectsHint")} errorLabel={t("common_error")} onRetry={reloadSubjects} />;
  }

  return (
    <div className="max-w-[980px]">
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {subjects.map((s) => (
          <Pill key={s.id} active={s.id === subjectId} onClick={() => setParams({ subject: s.id })}>
            <span className="flex items-center gap-1.5">
              <SubjectGlyph slug={s.slug} size={13} />
              {lang === "fr" ? s.name_fr : s.name_en}
            </span>
          </Pill>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : lessons.length === 0 ? (
        <StateNotice emptyLabel={t("ta_noLessons")} errorLabel={t("common_error")} />
      ) : (
        <div className="flex flex-col gap-2.5">
          {lessons.map((l) => {
            const editable = isTeacherEditable(l);
            const open = openId === l.id;
            return (
              <div key={l.id} className="bg-white border border-border rounded-2xl overflow-hidden">
                <div className="px-[18px] py-3.5 flex items-center gap-3 flex-wrap">
                  <Icon name="flask" size={16} className="text-ink-700 flex-none" />
                  <div className="flex-1 min-w-[150px]">
                    <div className="text-[13px] font-bold text-ink-900 truncate">{lang === "fr" ? l.title_fr : l.title_en || l.title_fr}</div>
                    <div className="text-[11.5px] text-muted">
                      {l.questionCount} {t("td_questions").toLowerCase()}
                    </div>
                  </div>
                  <ReviewStatusPill status={l.review_status} published={l.published} size="sm" />
                  <button
                    onClick={() => navigate(`/teacher/content/lesson/${l.id}`)}
                    className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-border text-ink-900 flex-none"
                  >
                    {t("admin_editLesson")}
                  </button>
                  <button
                    onClick={() => setOpenId(open ? null : l.id)}
                    className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border-none bg-brand-600 text-white flex-none"
                  >
                    {open ? t("admin_cancel") : t("admin_quiz")}
                  </button>
                </div>

                {open && (
                  <div className="border-t border-border px-[18px] py-4 bg-ink-50">
                    {editable ? (
                      <LessonQuizPanel lessonId={l.id} />
                    ) : (
                      <div className="flex items-center gap-2 text-[12px] text-muted">
                        <Icon name="lock" size={13} />
                        {l.review_status === "approved" ? t("tc_lockedApproved") : t("tc_lockedSubmitted")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

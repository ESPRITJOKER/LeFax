import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { ScreenHeader } from "../../components/ScreenHeader";
import { Button, ProgressBar, Spinner } from "../../components/ui";
import { Icon } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { LessonRow, QuizRow } from "../../lib/database.types";

export default function LessonDetail() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { lessonId } = useParams<{ lessonId: string }>();
  const { profile } = useAuth();

  const [lesson, setLesson] = useState<LessonRow | null>(null);
  const [siblings, setSiblings] = useState<LessonRow[]>([]);
  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !lessonId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { data: lessonRow } = await supabase.from("lessons").select("*").eq("id", lessonId).maybeSingle();
      setLesson(lessonRow ?? null);

      if (lessonRow) {
        const { data: siblingRows } = await supabase
          .from("lessons")
          .select("*")
          .eq("chapter_id", lessonRow.chapter_id)
          .order("position");
        setSiblings(siblingRows ?? []);

        const { data: quizRow } = await supabase.from("quizzes").select("*").eq("lesson_id", lessonRow.id).maybeSingle();
        setQuiz(quizRow ?? null);

        if (profile) {
          const { data: progressRow } = await supabase
            .from("lesson_progress")
            .select("*")
            .eq("user_id", profile.id)
            .eq("lesson_id", lessonRow.id)
            .maybeSingle();
          setIsFavorite(progressRow?.is_favorite ?? false);

          await supabase.from("lesson_progress").upsert(
            {
              user_id: profile.id,
              lesson_id: lessonRow.id,
              status: progressRow?.status === "done" ? "done" : "current",
              last_viewed_at: new Date().toISOString(),
            },
            { onConflict: "user_id,lesson_id" }
          );
        }
      }
      setLoading(false);
    })();
  }, [lessonId, profile]);

  async function toggleFavorite() {
    if (!profile || !lesson) return;
    const next = !isFavorite;
    setIsFavorite(next);
    await supabase.from("lesson_progress").upsert(
      { user_id: profile.id, lesson_id: lesson.id, is_favorite: next },
      { onConflict: "user_id,lesson_id" }
    );
  }

  if (loading) return <PhoneFrame><Spinner /></PhoneFrame>;
  if (!lesson) return <PhoneFrame><div className="p-6 text-sm text-muted">{isSupabaseConfigured ? t("common_error") : t("backend_banner")}</div></PhoneFrame>;

  const idx = siblings.findIndex((l) => l.id === lesson.id);
  const isFirst = idx <= 0;
  const isLast = idx >= siblings.length - 1;

  function goPrev() {
    if (!isFirst) navigate(`/lesson/${siblings[idx - 1].id}`);
  }
  function goNext() {
    if (!isLast) navigate(`/lesson/${siblings[idx + 1].id}`);
    else if (quiz) navigate(`/quiz/${quiz.id}`);
  }

  const objectives = lang === "fr" ? lesson.objectives_fr : lesson.objectives_en;
  const keyPoints = lang === "fr" ? lesson.key_points_fr : lesson.key_points_en;

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="flex items-center gap-3 px-[22px] pt-4">
          <button onClick={() => navigate(-1)} className="border-none bg-ink-100 w-[34px] h-[34px] rounded-[10px] flex items-center justify-center text-ink-800">
            <Icon name="chevleft" size={18} />
          </button>
          <div className="text-[11.5px] font-bold text-muted">
            {lang === "fr" ? "Leçon" : "Lesson"} {idx + 1}/{siblings.length}
          </div>
          <div className="flex-1" />
          <button onClick={toggleFavorite} className="text-ochre-600" aria-label="favorite">
            <Icon name="medal" size={18} />
          </button>
        </div>
        <div className="px-[22px] pt-3.5 pb-1.5">
          <ProgressBar pct={Math.round(((idx + 1) / Math.max(1, siblings.length)) * 100)} color="ink" />
        </div>

        <div className="px-[22px] pt-3.5 pb-24">
          <div className="font-serif font-bold text-[21px] text-ink-950 mb-3.5">{lang === "fr" ? lesson.title_fr : lesson.title_en}</div>

          <div className="flex items-center gap-3 mb-3.5 text-[11.5px] text-muted font-semibold">
            <span>{t("lesson_duration")}: {lesson.duration_minutes} min</span>
            <span>·</span>
            <span>{t(`lesson_difficulty_${lesson.difficulty}` as "lesson_difficulty_easy")}</span>
          </div>

          {objectives.length > 0 && (
            <>
              <div className="text-xs font-bold text-ink-800 mb-2">{t("lesson_objectives")}</div>
              <ul className="list-disc pl-[18px] flex flex-col gap-1.5 mb-4.5 mb-[18px]">
                {objectives.map((o, i) => (
                  <li key={i} className="text-[13px] text-ink-900 leading-normal">
                    {o}
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="text-[13.5px] leading-relaxed text-ink-900 mb-4.5">{lang === "fr" ? lesson.content_fr : lesson.content_en}</div>

          {keyPoints.length > 0 && (
            <>
              <div className="text-xs font-bold text-ink-800 mb-2">{t("lesson_keypoints")}</div>
              <ul className="list-disc pl-[18px] flex flex-col gap-1.5 mb-4">
                {keyPoints.map((k, i) => (
                  <li key={i} className="text-[13px] text-ink-900 leading-normal">
                    {k}
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="w-full aspect-[16/10] rounded-2xl bg-ink-50 flex items-center justify-center text-muted text-[11.5px] font-mono text-center p-3">
            {t("lesson_diagramPlaceholder")}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-border px-[22px] py-3 flex gap-2.5">
          <Button variant="secondary" onClick={goPrev} disabled={isFirst} className="flex-1">
            {t("previous")}
          </Button>
          <Button onClick={goNext} className="flex-1">
            {isLast && quiz ? t("quiz_finish") : t("next")}
          </Button>
        </div>
      </div>
    </PhoneFrame>
  );
}

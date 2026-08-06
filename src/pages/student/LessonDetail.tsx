import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { TopBar } from "../../components/TopBar";
import { Spinner } from "../../components/ui";
import { LessonCardDeck } from "../../components/LessonCardDeck";
import { useI18n } from "../../lib/i18n";
import { LessonContent } from "../../lib/lessonContent";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { LessonRow, LessonCardRow, QuizRow, ChapterRow } from "../../lib/database.types";

export default function LessonDetail() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { lessonId } = useParams<{ lessonId: string }>();
  const { profile } = useAuth();

  const [lesson, setLesson] = useState<LessonRow | null>(null);
  const [cards, setCards] = useState<LessonCardRow[]>([]);
  const [chapter, setChapter] = useState<ChapterRow | null>(null);
  const [siblings, setSiblings] = useState<LessonRow[]>([]);
  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [images, setImages] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !lessonId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { data: lessonRow } = await supabase.from("lessons").select("*").eq("id", lessonId).eq("published", true).maybeSingle();
      setLesson(lessonRow ?? null);

      if (lessonRow) {
        // Story cards (new model). Empty → fall back to the document viewer.
        const { data: cardRows } = await supabase
          .from("lesson_cards")
          .select("*")
          .eq("lesson_id", lessonRow.id)
          .order("position");
        setCards(cardRows ?? []);

        const { data: chapterRow } = await supabase.from("chapters").select("*").eq("id", lessonRow.chapter_id).maybeSingle();
        setChapter(chapterRow ?? null);

        const { data: siblingRows } = await supabase
          .from("lessons")
          .select("*")
          .eq("chapter_id", lessonRow.chapter_id)
          .eq("published", true)
          .order("position");
        setSiblings(siblingRows ?? []);

        const { data: quizRow } = await supabase.from("quizzes").select("*").eq("lesson_id", lessonRow.id).maybeSingle();
        setQuiz(quizRow ?? null);

        const { data: mediaRows } = await supabase
          .from("media_library")
          .select("image_slot, storage_path")
          .eq("lesson_id", lessonRow.id)
          .not("image_slot", "is", null);
        const map: Record<number, string> = {};
        for (const m of mediaRows ?? []) if (m.image_slot != null) map[m.image_slot] = m.storage_path;
        setImages(map);

        if (profile) {
          const { data: progressRow } = await supabase
            .from("lesson_progress")
            .select("*")
            .eq("user_id", profile.id)
            .eq("lesson_id", lessonRow.id)
            .maybeSingle();

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

  if (loading)
    return (
      <PhoneFrame>
        <Spinner />
      </PhoneFrame>
    );
  if (!lesson)
    return (
      <PhoneFrame>
        <div className="p-6 text-sm text-muted">{isSupabaseConfigured ? t("common_error") : t("backend_banner")}</div>
      </PhoneFrame>
    );

  const idx = siblings.findIndex((l) => l.id === lesson.id);
  const isLast = idx >= siblings.length - 1;
  const title = lang === "fr" ? lesson.title_fr : lesson.title_en;

  // Reaching the end of the deck (or the document viewer's button) routes into
  // that topic's practice session, else the next lesson, else back to chapter.
  function goNext() {
    if (quiz) navigate(`/quiz/${quiz.id}`);
    else if (!isLast) navigate(`/lesson/${siblings[idx + 1].id}`);
    else navigate(`/lessons/${lesson!.chapter_id}`);
  }

  // ── New story-card viewer ────────────────────────────────────────────────
  if (cards.length > 0) {
    return (
      <PhoneFrame>
        <LessonCardDeck
          cards={cards}
          lessonTitle={title}
          chapterName={chapter ? (lang === "fr" ? chapter.name_fr : chapter.name_en) : null}
          onFinish={goNext}
        />
      </PhoneFrame>
    );
  }

  // ── Fallback: legacy document viewer for lessons without cards ────────────
  const objectives = lang === "fr" ? lesson.objectives_fr : lesson.objectives_en;
  const keyPoints = lang === "fr" ? lesson.key_points_fr : lesson.key_points_en;

  return (
    <PhoneFrame>
      <div className="flex-1 min-h-0 flex flex-col bg-white">
        <TopBar variant="title" title={lang === "fr" ? "Leçon" : "Lesson"} onBack={() => navigate(-1)} />

        <div className="flex-1 min-h-0 overflow-auto px-[22px] pt-5 pb-[100px]">
          <h2 className="font-serif font-bold text-[20px] text-ink-900 mb-3.5">{title}</h2>

          <div className="flex items-center gap-2.5 mb-4 text-[11.5px] text-muted font-semibold">
            <span>
              {t("lesson_duration")}: {lesson.duration_minutes} min
            </span>
            <span>·</span>
            <span>{t(`lesson_difficulty_${lesson.difficulty}` as "lesson_difficulty_easy")}</span>
          </div>

          {objectives.length > 0 && (
            <>
              <div className="font-serif font-bold text-[13px] text-ink-900 mb-2">{t("lesson_objectives")}</div>
              <ul className="list-disc pl-[18px] flex flex-col gap-1.5 mb-4">
                {objectives.map((o, i) => (
                  <li key={i} className="text-[13px] text-ink-800 leading-normal">
                    {o}
                  </li>
                ))}
              </ul>
            </>
          )}

          <LessonContent text={lang === "fr" ? lesson.content_fr : lesson.content_en} images={images} />

          {keyPoints.length > 0 && (
            <>
              <div className="font-serif font-bold text-[13px] text-ink-900 mb-2 mt-4">{t("lesson_keypoints")}</div>
              <ul className="list-disc pl-[18px] flex flex-col gap-1.5">
                {keyPoints.map((k, i) => (
                  <li key={i} className="text-[13px] text-ink-800 leading-normal">
                    {k}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-[#f0f2f5] bg-white">
          <button
            onClick={goNext}
            className="w-full bg-brand-500 text-white rounded-[10px] py-[15px] font-serif font-bold text-[14.5px]"
          >
            {quiz ? (lang === "fr" ? "Commencer le quiz" : "Start the quiz") : isLast ? t("quiz_finish") : t("next")}
          </button>
        </div>
      </div>
    </PhoneFrame>
  );
}

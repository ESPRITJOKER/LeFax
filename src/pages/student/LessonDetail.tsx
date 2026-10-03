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

/** Only what next/previous navigation needs — not the siblings' whole bodies. */
type SiblingLesson = Pick<LessonRow, "id" | "title_fr" | "title_en" | "position" | "chapter_id">;

export default function LessonDetail() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { lessonId } = useParams<{ lessonId: string }>();
  const { profile } = useAuth();

  const [lesson, setLesson] = useState<LessonRow | null>(null);
  const [cards, setCards] = useState<LessonCardRow[]>([]);
  const [chapter, setChapter] = useState<ChapterRow | null>(null);
  const [siblings, setSiblings] = useState<SiblingLesson[]>([]);
  const [quiz, setQuiz] = useState<Pick<QuizRow, "id"> | null>(null);
  const [images, setImages] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const profileId = profile?.id ?? null;

  useEffect(() => {
    if (!isSupabaseConfigured || !lessonId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: lessonRow } = await supabase.from("lessons").select("*").eq("id", lessonId).eq("published", true).maybeSingle();
      if (cancelled) return;
      setLesson(lessonRow ?? null);

      if (lessonRow) {
        // These five reads do not depend on one another — only on the lesson
        // row we already have. Awaiting them one by one cost five serial
        // round trips (~1 s on a Cameroonian 3G link), which is most of the
        // "le chargement d'une page prend 1 à 2 secondes" the client measured.
        const [cardsRes, chapterRes, siblingsRes, quizRes, mediaRes] = await Promise.all([
          // Story cards (new model). Empty → fall back to the document viewer.
          supabase.from("lesson_cards").select("*").eq("lesson_id", lessonRow.id).order("position"),
          supabase.from("chapters").select("*").eq("id", lessonRow.chapter_id).maybeSingle(),
          // Only the fields the next/previous navigation actually needs — the
          // sibling bodies were multi-kB of content_fr/content_en per lesson.
          supabase
            .from("lessons")
            .select("id, title_fr, title_en, position, chapter_id")
            .eq("chapter_id", lessonRow.chapter_id)
            .eq("published", true)
            .order("position"),
          supabase.from("quizzes").select("id").eq("lesson_id", lessonRow.id).maybeSingle(),
          supabase.from("media_library").select("image_slot, storage_path").eq("lesson_id", lessonRow.id).not("image_slot", "is", null),
        ]);
        if (cancelled) return;

        setCards(cardsRes.data ?? []);
        setChapter(chapterRes.data ?? null);
        setSiblings((siblingsRes.data ?? []) as SiblingLesson[]);
        setQuiz(quizRes.data ?? null);

        const map: Record<number, string> = {};
        for (const m of mediaRes.data ?? []) if (m.image_slot != null) map[m.image_slot] = m.storage_path;
        setImages(map);
        setLoading(false);

        // Progress is a write, not something the page renders — it must not sit
        // on the critical path. Fired after the content is on screen.
        if (profileId) {
          void (async () => {
            const { data: progressRow } = await supabase
              .from("lesson_progress")
              .select("status")
              .eq("user_id", profileId)
              .eq("lesson_id", lessonRow.id)
              .maybeSingle();
            await supabase.from("lesson_progress").upsert(
              {
                user_id: profileId,
                lesson_id: lessonRow.id,
                status: progressRow?.status === "done" ? "done" : "current",
                last_viewed_at: new Date().toISOString(),
              },
              { onConflict: "user_id,lesson_id" }
            );
          })();
        }
        return;
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // Depending on `profile.id` rather than the whole `profile` object matters:
    // every auth event (including the hourly token refresh) used to hand down a
    // fresh object and re-run this entire load.
  }, [lessonId, profileId]);

  if (loading)
    return (
      <PhoneFrame nav="focus">
        <Spinner />
      </PhoneFrame>
    );
  if (!lesson)
    return (
      <PhoneFrame nav="focus">
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

  // The lesson body is only offered when there is actually one to read, so a
  // card-only lesson gains no dead button (Correction N6, remark 1).
  const hasBody = Boolean((lang === "fr" ? lesson.content_fr : lesson.content_en)?.trim() || lesson.content_fr?.trim());

  // ── New story-card viewer ────────────────────────────────────────────────
  if (cards.length > 0) {
    return (
      <PhoneFrame nav="focus">
        <LessonCardDeck
          cards={cards}
          lessonTitle={title}
          chapterName={chapter ? (lang === "fr" ? chapter.name_fr : chapter.name_en) : null}
          onFinish={goNext}
          onOpenCourse={hasBody ? () => navigate(`/lesson/${lesson.id}/cours`) : undefined}
          // `replace` so closing the card doesn't push a *second* stories entry
          // on top of the one we came from — otherwise the stories grid's back
          // arrow would step back onto the card instead of the chapter list
          // (Correction N3).
          onClose={() => navigate(`/chapter/${lesson!.chapter_id}/stories`, { replace: true })}
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

        <div className="flex-1 min-h-0 overflow-auto px-[22px] pt-5 pb-[100px] lg:max-w-[760px] lg:mx-auto lg:w-full lg:pt-7">
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

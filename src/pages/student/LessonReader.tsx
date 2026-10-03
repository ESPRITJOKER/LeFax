import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { TopBar } from "../../components/TopBar";
import { Spinner } from "../../components/ui";
import { StateNotice } from "../../components/StateNotice";
import { useI18n } from "../../lib/i18n";
import { LessonContent, type SlotImages, type SlotMeta } from "../../lib/lessonContent";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { LessonRow } from "../../lib/database.types";

/**
 * "Cours complet" — the full lesson text, as the student's reading view.
 *
 * Correction N6, remark 1: *"Je ne retrouve toujours pas l'utilité de cette
 * page. Pourtant je l'ai rempli mais elle ne s'affiche nulle part dans l'espace
 * utilisateur."* The teacher was filling `lessons.content_fr` in the editor,
 * and it was genuinely unreachable: `LessonDetail` returned the story-card deck
 * the moment a lesson had at least one card, which every real lesson does. The
 * body, the objectives, the summary, the key points and every uploaded
 * `[[IMG:]]` illustration were written to the database and never read back.
 *
 * This page is where they land. The story cards remain the default experience;
 * this is the second view, opened from the deck, so nothing a student already
 * knows moves.
 *
 * Isolation: the query is the same `published = true` read the deck uses, under
 * the same RLS — a student can only ever reach a published lesson, and nothing
 * here is user-specific, so there is no per-user data to leak.
 */
export default function LessonReader() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { lessonId } = useParams<{ lessonId: string }>();

  const [lesson, setLesson] = useState<LessonRow | null>(null);
  const [images, setImages] = useState<SlotImages>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !lessonId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      // Both reads at once: the body and its illustrations are independent.
      const [lessonRes, mediaRes] = await Promise.all([
        supabase.from("lessons").select("*").eq("id", lessonId).eq("published", true).maybeSingle(),
        // select("*") not an explicit column list: PostgREST fails the whole
        // query with 42703 when one column is missing, and migration 0021 (the
        // image-reference columns) may not be applied yet. With "*" the
        // references are simply absent until it is.
        supabase.from("media_library").select("*").eq("lesson_id", lessonId).not("image_slot", "is", null),
      ]);
      if (cancelled) return;

      if (lessonRes.error) {
        setError(lessonRes.error.message);
        setLoading(false);
        return;
      }
      setLesson(lessonRes.data ?? null);

      const map: Record<number, SlotMeta> = {};
      for (const m of mediaRes.data ?? [])
        if (m.image_slot != null)
          map[m.image_slot] = { url: m.storage_path, caption: m.caption ?? null, credit: m.credit ?? null, creditUrl: m.credit_url ?? null };
      setImages(map);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  if (loading)
    return (
      <PhoneFrame nav="focus">
        <Spinner />
      </PhoneFrame>
    );

  if (error || !lesson)
    return (
      <PhoneFrame nav="focus">
        <div className="flex-1 min-h-0 flex flex-col bg-card">
          <TopBar variant="title" title={lang === "fr" ? "Cours" : "Lesson"} onBack={() => navigate(-1)} />
          <div className="p-6">
            <StateNotice error={error} emptyLabel={t("ed_noBody")} errorLabel={t("common_error")} />
          </div>
        </div>
      </PhoneFrame>
    );

  const title = lang === "fr" ? lesson.title_fr : lesson.title_en;
  const bodyRaw = lang === "fr" ? lesson.content_fr : lesson.content_en;
  // A lesson may have been authored in one language only — fall back rather
  // than showing an empty page to an EN student.
  const body = bodyRaw?.trim() ? bodyRaw : lesson.content_fr;
  const objectives = lang === "fr" ? lesson.objectives_fr : lesson.objectives_en;
  const keyPoints = lang === "fr" ? lesson.key_points_fr : lesson.key_points_en;
  const summary = lang === "fr" ? lesson.summary_fr : lesson.summary_en;

  return (
    <PhoneFrame nav="focus">
      <div className="flex-1 min-h-0 flex flex-col bg-card">
        <TopBar variant="title" title={lang === "fr" ? "Cours complet" : "Full lesson"} onBack={() => navigate(-1)} />

        <div className="flex-1 min-h-0 overflow-auto px-[22px] pt-5 pb-10">
          <h2 className="font-serif font-bold text-[20px] text-ink-900 mb-3">{title}</h2>

          <div className="flex items-center gap-2.5 mb-4 text-[11.5px] text-muted font-semibold flex-wrap">
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

          {body?.trim() ? (
            <LessonContent text={body} images={images} />
          ) : (
            <StateNotice emptyLabel={t("ed_noBody")} errorLabel={t("common_error")} />
          )}

          {summary && (
            <>
              <div className="font-serif font-bold text-[13px] text-ink-900 mb-2 mt-4">{t("lesson_summary")}</div>
              <p className="text-[13px] text-ink-800 leading-relaxed">{summary}</p>
            </>
          )}

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

        <div className="px-5 py-3.5 border-t border-border bg-card">
          <button
            onClick={() => navigate(`/lesson/${lesson.id}`, { replace: true })}
            className="w-full bg-brand-600 text-white rounded-[10px] py-[14px] font-serif font-bold text-[14px] border-none"
          >
            {lang === "fr" ? "Revenir aux cartes" : "Back to the cards"}
          </button>
        </div>
      </div>
    </PhoneFrame>
  );
}

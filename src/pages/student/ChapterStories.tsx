import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { TopBar } from "../../components/TopBar";
import { Spinner, EmptyState } from "../../components/ui";
import { subjectEmoji } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { ChapterRow, LessonRow } from "../../lib/database.types";

interface StoryTile extends LessonRow {
  cover: string | null;
}

/**
 * Chapter "Stories" grid — the original platform's révision entry point
 * (screenshot image11: "{Chapter} / N Stories" then a grid of cover tiles).
 * Each published lesson is a story; tapping one opens its card deck.
 */
export default function ChapterStories() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const { chapterId } = useParams<{ chapterId: string }>();
  const { profile } = useAuth();

  const [chapter, setChapter] = useState<ChapterRow | null>(null);
  const [subjectSlug, setSubjectSlug] = useState<string>("");
  const [stories, setStories] = useState<StoryTile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !chapterId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { data: chapterRow } = await supabase.from("chapters").select("*").eq("id", chapterId).maybeSingle();
      setChapter(chapterRow ?? null);
      if (chapterRow) {
        const { data: subjectRow } = await supabase.from("subjects").select("slug").eq("id", chapterRow.subject_id).maybeSingle();
        setSubjectSlug(subjectRow?.slug ?? "");
      }

      const { data: lessonRows } = await supabase
        .from("lessons")
        .select("*")
        .eq("chapter_id", chapterId)
        .eq("published", true)
        .order("position");
      const lessons = lessonRows ?? [];

      // Cover = the first card's image (if the lesson has story cards).
      const lessonIds = lessons.map((l) => l.id);
      const { data: cardRows } = lessonIds.length
        ? await supabase.from("lesson_cards").select("lesson_id, image_fr, image_en, position").in("lesson_id", lessonIds).order("position")
        : { data: [] as { lesson_id: string; image_fr: string | null; image_en: string | null; position: number }[] };
      const coverByLesson = new Map<string, string | null>();
      for (const c of cardRows ?? []) {
        if (coverByLesson.has(c.lesson_id)) continue; // first (lowest position) wins
        coverByLesson.set(c.lesson_id, (lang === "fr" ? c.image_fr : c.image_en) ?? c.image_fr ?? c.image_en);
      }

      setStories(lessons.map((l) => ({ ...l, cover: coverByLesson.get(l.id) ?? null })));
      setLoading(false);
    })();
  }, [chapterId, lang]);

  const se = subjectEmoji(subjectSlug);
  const chapterName = chapter ? (lang === "fr" ? chapter.name_fr : chapter.name_en) : "...";

  return (
    <PhoneFrame>
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Back goes to the subject's chapter list — a fixed destination rather
            than navigate(-1), which after opening/closing a story card could
            otherwise land back on the card (Correction N3). */}
        <TopBar
          variant="back"
          coins={profile?.faxcoins ?? 0}
          onBack={() => (subjectSlug ? navigate(`/subjects/${subjectSlug}`) : navigate(-1))}
        />

        <div className="flex-1 min-h-0 overflow-auto px-5 pt-4 pb-[30px]">
          {/* Header: subject icon + "{Chapter} / N Stories" */}
          <div className="flex items-center gap-3.5 mb-5">
            <div className="w-[58px] h-[58px] rounded-2xl flex items-center justify-center text-[26px]" style={{ background: se.bg }}>
              {se.emoji}
            </div>
            <div>
              <div className="font-serif font-bold text-[18px] text-ink-900">{chapterName}</div>
              <div className="text-[13px] text-brand-600 font-semibold">
                {stories.length} {stories.length === 1 ? "Story" : "Stories"}
              </div>
            </div>
          </div>

          {loading ? (
            <Spinner />
          ) : stories.length === 0 ? (
            <EmptyState label={isSupabaseConfigured ? (lang === "fr" ? "Aucune story" : "No stories") : "Backend not configured"} />
          ) : (
            <>
              {/* Promo tile (image11: star mascot + "Parcours les stories…"). */}
              <div className="rounded-2xl bg-brand-50 px-4 py-4 mb-4 flex items-center gap-3">
                <div className="text-[30px]">🌟</div>
                <div className="text-[13.5px] text-ink-800 leading-[1.4] font-medium">
                  {lang === "fr" ? "Parcours les stories pour maîtriser ce fax" : "Go through the stories to master this fax"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {stories.map((s) => {
                  const title = lang === "fr" ? s.title_fr : s.title_en;
                  return (
                    <button
                      key={s.id}
                      onClick={() => navigate(`/lesson/${s.id}`)}
                      className="relative rounded-2xl overflow-hidden aspect-[3/4] flex items-end text-left shadow-[0_2px_10px_rgba(20,30,60,0.08)]"
                      style={{ background: s.cover ? "#0b1526" : se.bg }}
                    >
                      {s.cover ? (
                        <img src={s.cover} alt="" className="absolute inset-0 w-full h-full object-cover opacity-90" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-[38px] opacity-40">{se.emoji}</div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="relative z-10 p-3 font-serif font-bold text-[13px] text-white leading-[1.3]">{title}</div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}

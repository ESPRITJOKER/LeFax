import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { BottomTabs } from "../../components/BottomTabs";
import { TopBar } from "../../components/TopBar";
import { Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { ChapterRow, LessonRow, LessonProgressStatus } from "../../lib/database.types";

interface LessonWithStatus extends LessonRow {
  effectiveStatus: LessonProgressStatus;
}

export default function ChapterLessons() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const { chapterId } = useParams<{ chapterId: string }>();
  const { profile } = useAuth();

  const [chapter, setChapter] = useState<ChapterRow | null>(null);
  const [lessons, setLessons] = useState<LessonWithStatus[]>([]);
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
      const { data: lessonRows } = await supabase.from("lessons").select("*").eq("chapter_id", chapterId).eq("published", true).order("position");

      let progressByLesson: Record<string, LessonProgressStatus> = {};
      if (profile) {
        const { data: progressRows } = await supabase
          .from("lesson_progress")
          .select("lesson_id, status")
          .eq("user_id", profile.id)
          .in("lesson_id", (lessonRows ?? []).map((l) => l.id));
        progressByLesson = Object.fromEntries((progressRows ?? []).map((p) => [p.lesson_id, p.status]));
      }

      let firstUnlockedAssigned = false;
      const enriched = (lessonRows ?? []).map((l) => {
        let status = progressByLesson[l.id];
        if (!status) {
          status = firstUnlockedAssigned ? "locked" : "current";
          if (!firstUnlockedAssigned) firstUnlockedAssigned = true;
        } else if (status !== "done") {
          firstUnlockedAssigned = true;
        }
        return { ...l, effectiveStatus: status };
      });
      setLessons(enriched);
      setLoading(false);
    })();
  }, [chapterId, profile]);

  return (
    <PhoneFrame>
      <div className="flex-1 min-h-0 flex flex-col">
        <TopBar variant="back" coins={profile?.faxcoins ?? 0} onBack={() => navigate(-1)} />

        <div className="flex-1 min-h-0 overflow-auto px-5 pt-4 pb-[90px]">
          <h2 className="font-serif font-bold text-[17px] text-ink-900 mb-4">
            {chapter ? (lang === "fr" ? chapter.name_fr : chapter.name_en) : "..."}
          </h2>

          {loading ? (
            <Spinner />
          ) : lessons.length === 0 ? (
            <EmptyState label={isSupabaseConfigured ? (lang === "fr" ? "Aucune leçon" : "No lessons") : (lang === "fr" ? "Backend non configuré" : "Backend not configured")} />
          ) : (
            lessons.map((l, i) => {
              const done = l.effectiveStatus === "done";
              const locked = l.effectiveStatus === "locked";
              return (
                <div
                  key={l.id}
                  onClick={() => !locked && navigate(`/lesson/${l.id}`)}
                  className={`flex items-center gap-3.5 bg-card rounded-[12px] px-4 py-3.5 shadow-[0_2px_10px_rgba(20,30,60,0.05)] mb-2.5 ${
                    locked ? "opacity-60" : "cursor-pointer"
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: done ? "#22c55e" : "#eef1f5" }}
                  >
                    {done ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span className="text-[12px] text-muted font-bold">{i + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 font-serif font-semibold text-[13.5px] text-ink-900">{lang === "fr" ? l.title_fr : l.title_en}</div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 6l6 6-6 6" stroke="#c3cbd6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              );
            })
          )}
        </div>

        <BottomTabs active="revisions" />
      </div>
    </PhoneFrame>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { BottomTabs } from "../../components/BottomTabs";
import { TopBar } from "../../components/TopBar";
import { Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { SubjectRow, ChapterRow } from "../../lib/database.types";

interface ChapterProgress extends ChapterRow {
  lessonsCount: number;
  doneCount: number;
  progressPct: number;
  locked: boolean;
}

export default function SubjectChapters() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const { subjectId } = useParams<{ subjectId: string }>();
  const { profile } = useAuth();

  const [subject, setSubject] = useState<SubjectRow | null>(null);
  const [chapters, setChapters] = useState<ChapterProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { data: subjectRows } = await supabase.from("subjects").select("*").eq("track", "medicine").order("position");
      const current = (subjectRows ?? []).find((s) => s.slug === subjectId) ?? null;
      setSubject(current);
      if (!current) {
        setLoading(false);
        return;
      }
      const { data: chapterRows } = await supabase.from("chapters").select("*").eq("subject_id", current.id).order("position");
      const chapterIds = (chapterRows ?? []).map((c) => c.id);
      const { data: lessonRows } = chapterIds.length
        ? await supabase.from("lessons").select("id, chapter_id").eq("published", true).in("chapter_id", chapterIds)
        : { data: [] };
      let doneLessonIds = new Set<string>();
      if (profile) {
        const { data: progressRows } = await supabase.from("lesson_progress").select("lesson_id, status").eq("user_id", profile.id);
        doneLessonIds = new Set((progressRows ?? []).filter((p) => p.status === "done").map((p) => p.lesson_id));
      }
      let firstUnlockedAssigned = false;
      const enriched = (chapterRows ?? []).map((c) => {
        const lessonsForChapter = (lessonRows ?? []).filter((l) => l.chapter_id === c.id);
        const doneCount = lessonsForChapter.filter((l) => doneLessonIds.has(l.id)).length;
        const progressPct = lessonsForChapter.length ? Math.round((doneCount / lessonsForChapter.length) * 100) : 0;
        const isComplete = lessonsForChapter.length > 0 && progressPct === 100;
        let locked = false;
        if (lessonsForChapter.length > 0 && !isComplete) {
          locked = firstUnlockedAssigned;
          if (!locked) firstUnlockedAssigned = true;
        }
        return { ...c, lessonsCount: lessonsForChapter.length, doneCount, progressPct, locked };
      });
      setChapters(enriched);
      setLoading(false);
    })();
  }, [subjectId, profile]);

  return (
    <PhoneFrame>
      <div className="flex-1 min-h-0 flex flex-col">
        <TopBar variant="back" coins={profile?.faxcoins ?? 0} onBack={() => navigate("/dashboard")} />

        <div className="flex-1 min-h-0 overflow-auto px-5 pt-4 pb-[90px]">
          <h2 className="font-serif font-bold text-[19px] text-ink-900 mb-4">
            {subject ? (lang === "fr" ? subject.name_fr : subject.name_en) : "..."}
          </h2>

          {loading ? (
            <Spinner />
          ) : chapters.length === 0 ? (
            <EmptyState label={isSupabaseConfigured ? (lang === "fr" ? "Aucun chapitre" : "No chapters") : (lang === "fr" ? "Backend non configuré" : "Backend not configured")} />
          ) : (
            chapters.map((c, i) => (
              <div
                key={c.id}
                onClick={() => !c.locked && navigate(`/lessons/${c.id}`)}
                className={`bg-card rounded-[14px] p-4 shadow-[0_2px_10px_rgba(20,30,60,0.06)] mb-3 ${c.locked ? "opacity-60" : "cursor-pointer"}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-[11.5px] text-muted font-semibold mb-1">
                      {lang === "fr" ? "Chapitre" : "Chapter"} {i + 1}
                    </div>
                    <div className="font-serif font-semibold text-[14.5px] text-ink-900 max-w-[230px]">
                      {lang === "fr" ? c.name_fr : c.name_en}
                    </div>
                  </div>
                  <div className="text-[12px] text-brand-500 font-bold">
                    {c.doneCount}/{c.lessonsCount}
                  </div>
                </div>
                <div className="h-[6px] bg-ink-100 rounded-pill mt-3 overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-pill" style={{ width: `${c.progressPct}%` }} />
                </div>
              </div>
            ))
          )}
        </div>

        <BottomTabs active="revisions" />
      </div>
    </PhoneFrame>
  );
}

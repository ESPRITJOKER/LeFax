import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { BottomTabs } from "../../components/BottomTabs";
import { CoinsBadge } from "../../components/CoinsBadge";
import { Icon, subjectColors } from "../../lib/icons";
import { SubjectBadge } from "../../components/SubjectBadge";
import { Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { SubjectRow, ChapterRow } from "../../lib/database.types";

interface ChapterProgress extends ChapterRow {
  lessonsCount: number;
  progressPct: number;
  locked: boolean;
}

export default function SubjectChapters() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { subjectId } = useParams<{ subjectId: string }>();
  const { profile } = useAuth();

  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
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
      setSubjects(subjectRows ?? []);
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
      // First not-yet-completed chapter (in position order) is the unlocked
      // entry point, mirroring ChapterLessons' lesson-level sequencing —
      // everything after it stays locked until it's done; chapters with no
      // lessons yet (nothing to gate on) are never locked.
      let firstUnlockedAssigned = false;
      const enriched = (chapterRows ?? []).map((c) => {
        const lessonsForChapter = (lessonRows ?? []).filter((l) => l.chapter_id === c.id);
        const done = lessonsForChapter.filter((l) => doneLessonIds.has(l.id)).length;
        const progressPct = lessonsForChapter.length ? Math.round((done / lessonsForChapter.length) * 100) : 0;
        const isComplete = lessonsForChapter.length > 0 && progressPct === 100;
        let locked = false;
        if (lessonsForChapter.length > 0 && !isComplete) {
          locked = firstUnlockedAssigned;
          if (!locked) firstUnlockedAssigned = true;
        }
        return { ...c, lessonsCount: lessonsForChapter.length, progressPct, locked };
      });
      setChapters(enriched);
      setLoading(false);
    })();
  }, [subjectId, profile]);

  const subjectProgress = chapters.length
    ? Math.round(chapters.reduce((sum, c) => sum + c.progressPct, 0) / chapters.length)
    : 0;

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Header: hamburger + coins */}
        <div className="flex items-center justify-between px-5 py-3">
          <button onClick={() => navigate("/dashboard")} className="p-1">
            <div className="flex flex-col gap-1 w-5">
              <span className="block h-0.5 bg-brand-800 rounded-sm"></span>
              <span className="block h-0.5 bg-brand-800 rounded-sm"></span>
              <span className="block h-0.5 bg-brand-800 rounded-sm"></span>
            </div>
          </button>
          <CoinsBadge balance={profile?.faxcoins ?? 0} />
        </div>

        {/* Subject hero */}
        {subject && (() => {
          const sc = subjectColors(subject.slug);
          return (
            <div className="flex items-center gap-4 px-5 pt-2 pb-5">
              <SubjectBadge slug={subject.slug} size="lg" />
              <div>
                <div className="text-[19px] font-bold text-text leading-tight">
                  {lang === "fr" ? subject.name_fr : subject.name_en}
                </div>
                <div className="text-[12px] font-bold mt-0.5" style={{ color: sc.accent }}>
                  {chapters.length} {t("chap_progressLabel").split(" ")[0]}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Chapter list */}
        <div className="px-5 pb-6 flex flex-col gap-2.5">
          {loading ? (
            <Spinner />
          ) : chapters.length === 0 ? (
            <EmptyState label={isSupabaseConfigured ? t("common_error") : t("backend_banner")} />
          ) : (
            chapters.map((c, i) => (
              <div
                key={c.id}
                onClick={() => !c.locked && navigate(`/lessons/${c.id}`)}
                className={`flex items-center gap-3 p-4 bg-card border border-border rounded-[14px] ${c.locked ? "opacity-60" : "cursor-pointer hover:bg-ink-50"}`}
              >
                <div className="w-[22px] text-[13px] font-[800] shrink-0" style={{ color: subject ? subjectColors(subject.slug).accent : undefined }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="text-[13.5px] font-[700] text-text flex-1 truncate">
                  {lang === "fr" ? c.name_fr : c.name_en}
                </div>
                {c.locked && <Icon name="lock" size={16} className="text-muted shrink-0" />}
              </div>
            ))
          )}
        </div>

        <BottomTabs />
      </div>
    </PhoneFrame>
  );
}

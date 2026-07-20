import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { BottomTabs } from "../../components/BottomTabs";
import { ScreenHeader } from "../../components/ScreenHeader";
import { Pill, ProgressBar, RingProgress, Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { SubjectRow, ChapterRow } from "../../lib/database.types";

interface ChapterProgress extends ChapterRow {
  lessonsCount: number;
  progressPct: number;
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
        ? await supabase.from("lessons").select("id, chapter_id").in("chapter_id", chapterIds)
        : { data: [] };
      let doneLessonIds = new Set<string>();
      if (profile) {
        const { data: progressRows } = await supabase.from("lesson_progress").select("lesson_id, status").eq("user_id", profile.id);
        doneLessonIds = new Set((progressRows ?? []).filter((p) => p.status === "done").map((p) => p.lesson_id));
      }
      const enriched = (chapterRows ?? []).map((c) => {
        const lessonsForChapter = (lessonRows ?? []).filter((l) => l.chapter_id === c.id);
        const done = lessonsForChapter.filter((l) => doneLessonIds.has(l.id)).length;
        return {
          ...c,
          lessonsCount: lessonsForChapter.length,
          progressPct: lessonsForChapter.length ? Math.round((done / lessonsForChapter.length) * 100) : 0,
        };
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
        <ScreenHeader title={subject ? (lang === "fr" ? subject.name_fr : subject.name_en) : "..."} onBack={() => navigate("/dashboard")} />

        <div className="flex gap-2 px-[22px] pt-3.5 pb-1 overflow-x-auto">
          {subjects.map((s) => (
            <Pill key={s.id} active={s.slug === subjectId} onClick={() => navigate(`/subjects/${s.slug}`)}>
              {lang === "fr" ? s.name_fr : s.name_en}
            </Pill>
          ))}
        </div>

        {subject && (
          <div className="flex items-center gap-3.5 px-[22px] py-4">
            <RingProgress pct={subjectProgress} />
            <div className="text-[12.5px] text-muted">{t("chap_progressLabel")}</div>
          </div>
        )}

        <div className="px-[22px] pb-6 flex flex-col gap-3">
          {loading ? (
            <Spinner />
          ) : chapters.length === 0 ? (
            <EmptyState label={isSupabaseConfigured ? t("common_error") : t("backend_banner")} />
          ) : (
            chapters.map((c) => (
              <div
                key={c.id}
                onClick={() => navigate(`/lessons/${c.id}`)}
                className="cursor-pointer p-4 rounded-[15px] border border-border hover:bg-ink-50"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-[15px] font-bold text-ink-900">{lang === "fr" ? c.name_fr : c.name_en}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {c.lessonsCount} {t("chap_lessonsCount")}
                    </div>
                  </div>
                  <div className="text-xs font-bold text-success-600">{c.progressPct}%</div>
                </div>
                <div className="mt-2.5">
                  <ProgressBar pct={c.progressPct} />
                </div>
              </div>
            ))
          )}
        </div>
        <BottomTabs />
      </div>
    </PhoneFrame>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { ScreenHeader } from "../../components/ScreenHeader";
import { Icon } from "../../lib/icons";
import { Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { ChapterRow, LessonRow, LessonProgressStatus } from "../../lib/database.types";

interface LessonWithStatus extends LessonRow {
  effectiveStatus: LessonProgressStatus;
}

export default function ChapterLessons() {
  const { t, lang } = useI18n();
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
      const { data: lessonRows } = await supabase.from("lessons").select("*").eq("chapter_id", chapterId).order("position");

      let progressByLesson: Record<string, LessonProgressStatus> = {};
      if (profile) {
        const { data: progressRows } = await supabase
          .from("lesson_progress")
          .select("lesson_id, status")
          .eq("user_id", profile.id)
          .in("lesson_id", (lessonRows ?? []).map((l) => l.id));
        progressByLesson = Object.fromEntries((progressRows ?? []).map((p) => [p.lesson_id, p.status]));
      }

      // First lesson without progress defaults to "current" so the path always has an entry point.
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
      <div className="flex-1 flex flex-col overflow-y-auto">
        <ScreenHeader title={chapter ? (lang === "fr" ? chapter.name_fr : chapter.name_en) : "..."} />
        <div className="px-[22px] pt-4 pb-6 flex flex-col gap-2.5">
          {loading ? (
            <Spinner />
          ) : lessons.length === 0 ? (
            <EmptyState label={isSupabaseConfigured ? t("common_error") : t("backend_banner")} />
          ) : (
            lessons.map((l) => {
              const done = l.effectiveStatus === "done";
              const current = l.effectiveStatus === "current";
              const locked = l.effectiveStatus === "locked";
              return (
                <div
                  key={l.id}
                  onClick={() => !locked && navigate(`/lesson/${l.id}`)}
                  className={`flex items-center gap-3 px-[15px] py-3.5 rounded-2xl border-[1.5px] ${
                    current ? "border-ink-300 bg-ink-50" : "border-border bg-white"
                  } ${locked ? "opacity-55" : "cursor-pointer"}`}
                >
                  <div
                    className={`w-[30px] h-[30px] flex-none rounded-full flex items-center justify-center ${
                      done ? "bg-success-600 text-white" : current ? "bg-ink-700 text-white" : "bg-ink-100 text-muted"
                    }`}
                  >
                    <Icon name={done ? "check" : locked ? "lock" : "book"} size={13} />
                  </div>
                  <div className="flex-1 text-sm font-semibold text-ink-900">{lang === "fr" ? l.title_fr : l.title_en}</div>
                  <div
                    className={`text-[10.5px] font-bold uppercase tracking-wide ${
                      done ? "text-success-600" : current ? "text-ink-700" : "text-muted"
                    }`}
                  >
                    {done
                      ? lang === "fr"
                        ? "Terminé"
                        : "Done"
                      : current
                      ? lang === "fr"
                        ? "En cours"
                        : "Current"
                      : lang === "fr"
                      ? "Verrouillé"
                      : "Locked"}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}

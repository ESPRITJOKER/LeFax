import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { BottomTabs } from "../../components/BottomTabs";
import { ProgressBar, Spinner } from "../../components/ui";
import { Icon, type IconName } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { SubjectRow, MockExamRow } from "../../lib/database.types";

interface SubjectProgress extends SubjectRow {
  progressPct: number;
}

export default function Dashboard() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [subjects, setSubjects] = useState<SubjectProgress[]>([]);
  const [nextMock, setNextMock] = useState<MockExamRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data: subjectRows } = await supabase.from("subjects").select("*").eq("track", "medicine").order("position");
      const { data: mockRows } = await supabase
        .from("mock_exams")
        .select("*")
        .in("status", ["scheduled", "open"])
        .order("opens_at")
        .limit(1);

      let progressBySubject: Record<string, number> = {};
      if (profile && subjectRows) {
        const { data: chapterRows } = await supabase.from("chapters").select("id, subject_id");
        const { data: lessonRows } = await supabase.from("lessons").select("id, chapter_id");
        const { data: progressRows } = await supabase
          .from("lesson_progress")
          .select("lesson_id, status")
          .eq("user_id", profile.id);

        const chapterToSubject = new Map((chapterRows ?? []).map((c) => [c.id, c.subject_id]));
        const lessonToSubject = new Map((lessonRows ?? []).map((l) => [l.id, chapterToSubject.get(l.chapter_id)]));
        const doneLessonIds = new Set((progressRows ?? []).filter((p) => p.status === "done").map((p) => p.lesson_id));

        const totalsBySubject: Record<string, number> = {};
        const doneBySubject: Record<string, number> = {};
        for (const l of lessonRows ?? []) {
          const subjectId = lessonToSubject.get(l.id);
          if (!subjectId) continue;
          totalsBySubject[subjectId] = (totalsBySubject[subjectId] ?? 0) + 1;
          if (doneLessonIds.has(l.id)) doneBySubject[subjectId] = (doneBySubject[subjectId] ?? 0) + 1;
        }
        progressBySubject = Object.fromEntries(
          subjectRows.map((s) => [s.id, totalsBySubject[s.id] ? Math.round(((doneBySubject[s.id] ?? 0) / totalsBySubject[s.id]) * 100) : 0])
        );
      }

      setSubjects((subjectRows ?? []).map((s) => ({ ...s, progressPct: progressBySubject[s.id] ?? 0 })));
      setNextMock(mockRows?.[0] ?? null);
      setLoading(false);
    })();
  }, [profile]);

  const firstName = profile?.first_name || (lang === "fr" ? "Étudiant" : "Student");

  const quickAccess: { label: string; icon: IconName; bg: string; color: string; action: () => void }[] = [
    { label: t("nav_courses"), icon: "book", bg: "bg-ink-100", color: "text-ink-700", action: () => navigate("/subjects/biologie") },
    { label: t("nav_mockExam"), icon: "target", bg: "bg-ochre-100", color: "text-ochre-700", action: () => navigate("/mock-exam") },
    { label: t("nav_tasks"), icon: "clipboard", bg: "bg-success-50", color: "text-success-600", action: () => navigate("/tasks") },
    { label: t("nav_leaderboard"), icon: "trophy", bg: "bg-ochre-100", color: "text-ochre-700", action: () => navigate("/leaderboard") },
    { label: t("nav_profile"), icon: "user", bg: "bg-ink-100", color: "text-ink-700", action: () => navigate("/profile") },
  ];

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="bg-ink-950 px-[22px] pt-5 pb-6.5 pb-[26px] rounded-b-[22px] text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs opacity-70 font-semibold">{t("dash_hello")}</div>
              <div className="font-serif font-bold text-[21px] mt-0.5">{firstName}</div>
            </div>
            <div className="flex items-center gap-2 bg-ink-800 px-3.5 py-2 rounded-pill">
              <Icon name="coin" size={16} className="text-ochre-600 animate-coinspin" />
              <span className="font-bold text-[14.5px]">{profile?.faxcoins ?? 0}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 bg-ink-800/55 w-fit px-3.5 py-2 rounded-xl">
            <Icon name="flame" size={17} className="text-[oklch(70%_0.15_55)] animate-flamepulse" />
            <span className="text-[13.5px] font-bold">{profile?.streak_count ?? 0}</span>
            <span className="text-xs opacity-75">{t("dash_streakLabel")}</span>
          </div>
        </div>

        <div className="px-[22px] pt-5 pb-2">
          <div className="text-[13.5px] font-bold text-ink-900 mb-3">{t("dash_progressTitle")}</div>
          {loading ? (
            <Spinner />
          ) : subjects.length === 0 ? (
            <div className="text-sm text-muted py-4">{isSupabaseConfigured ? t("common_error") : t("backend_banner")}</div>
          ) : (
            <div className="flex flex-col gap-3">
              {subjects.map((s) => (
                <div
                  key={s.id}
                  onClick={() => navigate(`/subjects/${s.slug}`)}
                  className="cursor-pointer p-3.5 rounded-2xl border border-border hover:bg-ink-50"
                >
                  <div className="flex justify-between text-[13.5px] mb-2">
                    <span className="font-bold text-ink-900">{lang === "fr" ? s.name_fr : s.name_en}</span>
                    <span className="text-muted font-semibold">{s.progressPct}%</span>
                  </div>
                  <ProgressBar pct={s.progressPct} />
                </div>
              ))}
            </div>
          )}
        </div>

        {nextMock && (
          <div className="px-[22px] pb-2">
            <div className="text-[13.5px] font-bold text-ink-900 mb-2">{t("dash_nextMock")}</div>
            <div onClick={() => navigate("/mock-exam")} className="cursor-pointer p-3.5 rounded-2xl bg-ochre-50 border border-ochre-100 text-sm font-semibold text-ochre-700">
              {lang === "fr" ? nextMock.title_fr : nextMock.title_en}
            </div>
          </div>
        )}

        <div className="px-[22px] pt-3.5 pb-6">
          <div className="text-[13.5px] font-bold text-ink-900 mb-3">{t("dash_quickAccess")}</div>
          <div className="grid grid-cols-3 gap-3">
            {quickAccess.map((q) => (
              <div
                key={q.label}
                onClick={q.action}
                className="cursor-pointer flex flex-col items-center gap-2 py-3.5 px-1.5 rounded-2xl bg-ink-50 hover:bg-ink-100"
              >
                <div className={`w-10 h-10 rounded-[11px] flex items-center justify-center ${q.bg} ${q.color}`}>
                  <Icon name={q.icon} size={19} />
                </div>
                <div className="text-[11.5px] font-semibold text-ink-800 text-center">{q.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1" />
        <BottomTabs />
      </div>
    </PhoneFrame>
  );
}

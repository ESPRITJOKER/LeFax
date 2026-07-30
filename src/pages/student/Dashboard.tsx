import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { BottomTabs } from "../../components/BottomTabs";
import { TopBar } from "../../components/TopBar";
import { Drawer } from "../../components/Drawer";
import { Spinner } from "../../components/ui";
import { subjectEmoji } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { SubjectRow } from "../../lib/database.types";

interface SubjectProgress extends SubjectRow {
  progressPct: number;
}

export default function Dashboard() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [subjects, setSubjects] = useState<SubjectProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data: subjectRows } = await supabase.from("subjects").select("*").eq("track", "medicine").order("position");

      let progressBySubject: Record<string, number> = {};
      if (profile && subjectRows) {
        const { data: chapterRows } = await supabase.from("chapters").select("id, subject_id");
        const { data: lessonRows } = await supabase.from("lessons").select("id, chapter_id").eq("published", true);
        const { data: progressRows } = await supabase.from("lesson_progress").select("lesson_id, status").eq("user_id", profile.id);

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
      setLoading(false);
    })();
  }, [profile]);

  const firstName = profile?.first_name || (lang === "fr" ? "Étudiant" : "Student");
  const initial = (profile?.first_name?.[0] ?? "?").toUpperCase();

  return (
    <PhoneFrame>
      <div className="flex-1 min-h-0 flex flex-col">
        <TopBar
          variant="menu"
          coins={profile?.faxcoins ?? 0}
          initial={initial}
          onMenu={() => setDrawer(true)}
          onCoins={() => navigate("/shop")}
          onAvatar={() => navigate("/profile")}
        />

        <div className="flex-1 min-h-0 overflow-auto pb-[90px]">
          <div className="px-5 pt-5">
            <p className="font-serif font-bold text-[19px] text-ink-900 mb-0.5">
              {lang === "fr" ? `Bonjour ${firstName} 👋` : `Hi ${firstName} 👋`}
            </p>
            <p className="text-[13px] text-[#647084] mb-[18px]">
              {lang === "fr" ? "Continue sur ta lancée aujourd'hui" : "Keep up the momentum today"}
            </p>

            <div className="bg-brand-800 rounded-[14px] px-[18px] py-4 flex items-center justify-between mb-5">
              <div>
                <div className="font-serif font-bold text-[14px] text-white">
                  {lang === "fr" ? `Série de ${profile?.streak_count ?? 0} jours` : `${profile?.streak_count ?? 0}-day streak`}
                </div>
                <div className="text-[12px] text-[#9fb3cc] mt-0.5">
                  {lang === "fr" ? "Termine une leçon aujourd'hui" : "Finish a lesson today"}
                </div>
              </div>
              <div className="bg-ochre-600 text-ink-900 font-serif font-extrabold text-[16px] rounded-[10px] px-3 py-2">
                {profile?.streak_count ?? 0}🔥
              </div>
            </div>

            <p className="font-serif font-bold text-[15px] text-ink-900 mb-3">{lang === "fr" ? "Mes matières" : "My subjects"}</p>
          </div>

          <div className="px-5 flex flex-col gap-3">
            {loading ? (
              <Spinner />
            ) : subjects.length === 0 ? (
              <div className="text-sm text-muted py-4">
                {isSupabaseConfigured ? (lang === "fr" ? "Aucune matière" : "No subjects") : (lang === "fr" ? "Backend non configuré" : "Backend not configured")}
              </div>
            ) : (
              subjects.map((s) => {
                const se = subjectEmoji(s.slug);
                return (
                  <div
                    key={s.id}
                    onClick={() => navigate(`/subjects/${s.slug}`)}
                    className="flex items-center gap-3.5 bg-card rounded-[14px] px-4 py-3.5 shadow-[0_2px_10px_rgba(20,30,60,0.06)] cursor-pointer"
                  >
                    <div className="w-[46px] h-[46px] rounded-xl flex items-center justify-center text-[22px]" style={{ background: se.bg }}>
                      {se.emoji}
                    </div>
                    <div className="flex-1">
                      <div className="font-serif font-semibold text-[14.5px] text-ink-900">{lang === "fr" ? s.name_fr : s.name_en}</div>
                      <div className="h-[6px] bg-ink-100 rounded-pill mt-2 overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-pill" style={{ width: `${s.progressPct}%` }} />
                      </div>
                    </div>
                    <div className="text-[12px] text-muted font-semibold">{s.progressPct}%</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <BottomTabs active="revisions" />
        <Drawer open={drawer} onClose={() => setDrawer(false)} />
      </div>
    </PhoneFrame>
  );
}

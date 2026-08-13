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

interface SubjectMastery extends SubjectRow {
  total: number;
  done: number;
  pct: number;
}

interface RecentAttempt {
  id: string;
  title: string;
  score: number;
  when: string;
}

/**
 * Personal Performance ("Perfs") screen — the original platform's Perfs tab
 * showed each student's own mastery, distinct from the Classement (which lives
 * under Evaluations). Corrections doc: "La partie performance n'est pas remplie
 * encore." All figures come from RLS-scoped tables the client can already read
 * (lesson_progress, quiz_attempts, student_answers) — no backend needed.
 */
export default function Performance() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [mastery, setMastery] = useState<SubjectMastery[]>([]);
  const [lessonsDone, setLessonsDone] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [recent, setRecent] = useState<RecentAttempt[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured || !profile) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);

      const [{ data: subjects }, { data: chapters }, { data: lessons }, { data: progress }, { data: attempts }, { data: quizzes }] = await Promise.all([
        supabase.from("subjects").select("*").eq("track", "medicine").order("position"),
        supabase.from("chapters").select("id, subject_id"),
        supabase.from("lessons").select("id, chapter_id, title_fr, title_en").eq("published", true),
        supabase.from("lesson_progress").select("lesson_id, status").eq("user_id", profile.id),
        supabase.from("quiz_attempts").select("id, quiz_id, score, submitted_at").eq("user_id", profile.id).not("submitted_at", "is", null).order("submitted_at", { ascending: false }),
        supabase.from("quizzes").select("id, lesson_id"),
      ]);

      const chapterToSubject = new Map((chapters ?? []).map((c) => [c.id, c.subject_id]));
      const lessonToSubject = new Map((lessons ?? []).map((l) => [l.id, chapterToSubject.get(l.chapter_id)]));
      const lessonTitle = new Map((lessons ?? []).map((l) => [l.id, lang === "fr" ? l.title_fr : l.title_en]));
      const doneLessonIds = new Set((progress ?? []).filter((p) => p.status === "done").map((p) => p.lesson_id));

      // Per-subject mastery = share of the subject's published lessons completed.
      const totalBySubject: Record<string, number> = {};
      const doneBySubject: Record<string, number> = {};
      for (const l of lessons ?? []) {
        const sid = lessonToSubject.get(l.id);
        if (!sid) continue;
        totalBySubject[sid] = (totalBySubject[sid] ?? 0) + 1;
        if (doneLessonIds.has(l.id)) doneBySubject[sid] = (doneBySubject[sid] ?? 0) + 1;
      }
      setMastery(
        (subjects ?? []).map((s) => {
          const total = totalBySubject[s.id] ?? 0;
          const done = doneBySubject[s.id] ?? 0;
          return { ...s, total, done, pct: total ? Math.round((done / total) * 100) : 0 };
        })
      );
      setLessonsDone(doneLessonIds.size);

      // Accuracy across every answer this student has submitted.
      const attemptIds = (attempts ?? []).map((a) => a.id);
      const { data: answers } = attemptIds.length
        ? await supabase.from("student_answers").select("is_correct, attempt_id").in("attempt_id", attemptIds)
        : { data: [] as { is_correct: boolean; attempt_id: string }[] };
      const answered = (answers ?? []).length;
      const correct = (answers ?? []).filter((a) => a.is_correct).length;
      setQuestionsAnswered(answered);
      setAccuracy(answered ? Math.round((correct / answered) * 100) : 0);

      // Recent activity — last 5 completed attempts, labelled by lesson.
      const quizToLesson = new Map((quizzes ?? []).map((q) => [q.id, q.lesson_id]));
      setRecent(
        (attempts ?? []).slice(0, 5).map((a) => {
          const lessonId = quizToLesson.get(a.quiz_id);
          const title = (lessonId ? lessonTitle.get(lessonId) : null) ?? (lang === "fr" ? "Concours blanc" : "Mock exam");
          return { id: a.id, title, score: a.score ?? 0, when: a.submitted_at ?? "" };
        })
      );

      setLoading(false);
    })();
  }, [profile, lang]);

  const initial = (profile?.first_name?.[0] ?? "?").toUpperCase();

  const tiles = [
    { value: String(profile?.faxcoins ?? 0), label: "FaxCoins", color: "#f5b400" },
    { value: String(lessonsDone), label: lang === "fr" ? "Leçons terminées" : "Lessons done", color: "#2f9bf0" },
    { value: String(questionsAnswered), label: lang === "fr" ? "Questions" : "Questions", color: "#7c3aed" },
    { value: `${accuracy}%`, label: lang === "fr" ? "Précision" : "Accuracy", color: "#22c55e" },
  ];

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

        <div className="flex-1 min-h-0 overflow-auto px-5 pt-4 pb-[90px]">
          <h2 className="font-serif font-bold text-[18px] text-ink-900 mb-4">{lang === "fr" ? "Ma performance" : "My performance"}</h2>

          {loading ? (
            <Spinner />
          ) : (
            <>
              {/* Stat tiles */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {tiles.map((tile) => (
                  <div key={tile.label} className="bg-card rounded-[14px] px-4 py-3.5 shadow-[0_2px_10px_rgba(20,30,60,0.05)]">
                    <div className="font-serif font-extrabold text-[22px]" style={{ color: tile.color }}>
                      {tile.value}
                    </div>
                    <div className="text-[12px] text-muted mt-0.5">{tile.label}</div>
                  </div>
                ))}
              </div>

              {/* Per-subject mastery */}
              <p className="font-serif font-bold text-[15px] text-ink-900 mb-3">{lang === "fr" ? "Maîtrise par matière" : "Mastery by subject"}</p>
              <div className="flex flex-col gap-3 mb-6">
                {mastery.map((s) => {
                  const se = subjectEmoji(s.slug);
                  return (
                    <div key={s.id} className="bg-card rounded-[14px] px-4 py-3.5 shadow-[0_2px_10px_rgba(20,30,60,0.05)] flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[19px]" style={{ background: se.bg }}>
                        {se.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1.5">
                          <span className="font-serif font-semibold text-[14px] text-ink-900 truncate">{lang === "fr" ? s.name_fr : s.name_en}</span>
                          <span className="text-[11.5px] text-muted font-semibold flex-shrink-0 ml-2">
                            {s.done}/{s.total}
                          </span>
                        </div>
                        <div className="h-[6px] bg-ink-100 rounded-pill overflow-hidden">
                          <div className="h-full bg-brand-500 rounded-pill" style={{ width: `${s.pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Recent activity */}
              <p className="font-serif font-bold text-[15px] text-ink-900 mb-3">{lang === "fr" ? "Activité récente" : "Recent activity"}</p>
              {recent.length === 0 ? (
                <div className="text-[13px] text-muted py-3">
                  {lang === "fr" ? "Aucune activité pour l'instant. Termine une leçon pour commencer." : "No activity yet. Finish a lesson to get started."}
                </div>
              ) : (
                <div className="bg-card rounded-[14px] px-4 py-1 shadow-[0_2px_10px_rgba(20,30,60,0.05)]">
                  {recent.map((r) => {
                    const passed = r.score >= 50;
                    return (
                      <div key={r.id} className="flex items-center gap-3 py-3 border-b border-[#f4f6f9] last:border-0">
                        <div className="flex-1 min-w-0">
                          <div className="text-[13.5px] font-semibold text-ink-900 truncate">{r.title}</div>
                          <div className="text-[11px] text-muted mt-0.5">
                            {r.when ? new Date(r.when).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { day: "numeric", month: "short" }) : ""}
                          </div>
                        </div>
                        <div className="font-serif font-bold text-[14px] flex-shrink-0" style={{ color: passed ? "#22c55e" : "#ef4444" }}>
                          {r.score}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <BottomTabs active="perfs" />
        <Drawer open={drawer} onClose={() => setDrawer(false)} />
      </div>
    </PhoneFrame>
  );
}

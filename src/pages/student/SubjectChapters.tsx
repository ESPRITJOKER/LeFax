import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { BottomTabs } from "../../components/BottomTabs";
import { TopBar } from "../../components/TopBar";
import { Spinner, EmptyState } from "../../components/ui";
import { subjectEmoji } from "../../lib/icons";
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

/** One of the four chapter steps: a colored circle (symbol only) + label,
 *  reproducing the original platform's step row (screenshot image10). */
function StepButton({
  label,
  color,
  glyph,
  done = false,
  onClick,
}: {
  label: string;
  color: string;
  glyph: "stories" | "1" | "2" | "3";
  done?: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 w-[22%]">
      <span
        className="relative w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: `${color}1a`, border: `2px solid ${color}` }}
      >
        {glyph === "stories" ? (
          <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="3" />
            <path d="M9 4v16" />
          </svg>
        ) : (
          <span className="font-serif font-extrabold text-[17px]" style={{ color }}>
            {glyph}
          </span>
        )}
        {done && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-success-600 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-2.5 h-2.5"><path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        )}
      </span>
      <span className="text-[10.5px] font-semibold text-ink-700">{label}</span>
    </button>
  );
}

export default function SubjectChapters() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const { subjectId } = useParams<{ subjectId: string }>();
  const { profile } = useAuth();

  const [subject, setSubject] = useState<SubjectRow | null>(null);
  const [chapters, setChapters] = useState<ChapterProgress[]>([]);
  const [loading, setLoading] = useState(true);

  // Remember which chapter's step "cards" (Stories/Niv 1/2/3) were open, keyed
  // per subject, so returning from a practice round via navigate(-1) — which
  // remounts this screen — lands the student back on the cards instead of a
  // collapsed list with no visible path to them (corrections doc).
  const cardsKey = `lefax_open_chapter:${subjectId ?? ""}`;
  const [expanded, setExpanded] = useState<string | null>(() =>
    typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(cardsKey)
  );

  function toggleChapter(id: string) {
    setExpanded((cur) => {
      const next = cur === id ? null : id;
      if (typeof sessionStorage !== "undefined") {
        if (next) sessionStorage.setItem(cardsKey, next);
        else sessionStorage.removeItem(cardsKey);
      }
      return next;
    });
  }

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
          {/* Subject hero (original platform image8: icon tile + name + N chapitres). */}
          <div className="flex items-center gap-3.5 mb-5">
            <div className="w-[58px] h-[58px] rounded-2xl flex items-center justify-center text-[26px]" style={{ background: subjectEmoji(subject?.slug ?? "").bg }}>
              {subjectEmoji(subject?.slug ?? "").emoji}
            </div>
            <div>
              <div className="font-serif font-bold text-[19px] text-ink-900">
                {subject ? (lang === "fr" ? subject.name_fr : subject.name_en) : "..."}
              </div>
              <div className="text-[13px] text-brand-600 font-semibold">
                {chapters.length} {lang === "fr" ? (chapters.length === 1 ? "chapitre" : "chapitres") : chapters.length === 1 ? "chapter" : "chapters"}
              </div>
            </div>
          </div>

          {loading ? (
            <Spinner />
          ) : chapters.length === 0 ? (
            <EmptyState label={isSupabaseConfigured ? (lang === "fr" ? "Aucun chapitre" : "No chapters") : (lang === "fr" ? "Backend non configuré" : "Backend not configured")} />
          ) : (
            chapters.map((c, i) => {
              const isOpen = expanded === c.id;
              return (
                <div key={c.id} className={`bg-card rounded-[14px] shadow-[0_2px_10px_rgba(20,30,60,0.06)] mb-3 overflow-hidden ${c.locked ? "opacity-60" : ""}`}>
                  {/* Chapter header — tap to expand the 4-step row (original image10). */}
                  <div
                    onClick={() => !c.locked && toggleChapter(c.id)}
                    className={`flex items-center gap-3 p-4 ${c.locked ? "" : "cursor-pointer"}`}
                  >
                    <div className="font-serif font-extrabold text-[18px] text-brand-500 w-7 flex-shrink-0 tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-serif font-semibold text-[14.5px] text-ink-900">{lang === "fr" ? c.name_fr : c.name_en}</div>
                      <div className="text-[11.5px] text-muted mt-0.5">
                        {c.doneCount}/{c.lessonsCount} {lang === "fr" ? "stories" : "stories"}
                      </div>
                    </div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={`flex-shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}>
                      <path d="M9 6l6 6-6 6" stroke="#c3cbd6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 border-t border-ink-100">
                      <div className="text-[11px] text-muted font-semibold mb-3 mt-3">
                        {lang === "fr" ? "Valide les différentes étapes" : "Complete the different steps"}
                      </div>
                      <div className="flex justify-between">
                        <StepButton
                          label={lang === "fr" ? "Stories" : "Stories"}
                          color="#2f9bf0"
                          done={c.lessonsCount > 0 && c.doneCount >= c.lessonsCount}
                          onClick={() => navigate(`/chapter/${c.id}/stories`)}
                          glyph="stories"
                        />
                        <StepButton label={lang === "fr" ? "Niv. 1" : "Lvl 1"} color="#22c55e" onClick={() => navigate(`/chapter/${c.id}/practice/1`)} glyph="1" />
                        <StepButton label={lang === "fr" ? "Niv. 2" : "Lvl 2"} color="#f5b400" onClick={() => navigate(`/chapter/${c.id}/practice/2`)} glyph="2" />
                        <StepButton label={lang === "fr" ? "Niv. 3" : "Lvl 3"} color="#ef4444" onClick={() => navigate(`/chapter/${c.id}/practice/3`)} glyph="3" />
                      </div>
                    </div>
                  )}
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

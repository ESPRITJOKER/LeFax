import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { useI18n } from "../../lib/i18n";
import { supabase, isSupabaseConfigured, invokeFn } from "../../lib/supabaseClient";

interface ResultState {
  score: number;
  correct: number;
  total: number;
  coinsEarned: number;
  offline?: boolean;
}

export default function QuizResult() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const { quizId } = useParams<{ quizId: string }>();
  const location = useLocation();
  const state = (location.state as ResultState) ?? { score: 0, correct: 0, total: 0, coinsEarned: 0 };

  const [animCoins, setAnimCoins] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [nextHref, setNextHref] = useState<string | null>(null);
  const [nextIsLesson, setNextIsLesson] = useState(false);
  const completeRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !quizId || completeRef.current) return;
    completeRef.current = true;
    (async () => {
      const { data: quizRow } = await supabase.from("quizzes").select("lesson_id").eq("id", quizId).maybeSingle();
      const lessonId = quizRow?.lesson_id;
      if (!lessonId) return;

      try {
        await invokeFn("courses", { action: "complete_lesson", lesson_id: lessonId });
      } catch {
        // Backend unreachable — the lesson just won't be flagged done yet.
      }

      const { data: lessonRow } = await supabase.from("lessons").select("chapter_id").eq("id", lessonId).maybeSingle();
      if (!lessonRow) return;
      const { data: siblings } = await supabase.from("lessons").select("id").eq("chapter_id", lessonRow.chapter_id).eq("published", true).order("position");
      const list = siblings ?? [];
      const idx = list.findIndex((l) => l.id === lessonId);
      const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
      if (next) {
        setNextHref(`/lesson/${next.id}`);
        setNextIsLesson(true);
      } else {
        setNextHref(`/lessons/${lessonRow.chapter_id}`);
        setNextIsLesson(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  useEffect(() => {
    let c = 0;
    timer.current = setInterval(() => {
      c = Math.min(state.coinsEarned, c + Math.max(1, Math.round(state.coinsEarned / 20)));
      setAnimCoins(c);
      if (c >= state.coinsEarned && timer.current) clearInterval(timer.current);
    }, 35);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [state.coinsEarned]);

  // Tie both the ring colour and the encouragement to the actual score — a 0/9
  // must not read "Bien joué" over a green ring (corrections doc). Green for a
  // strong pass, amber mid, red when the lesson needs another pass.
  const pct = state.total > 0 ? Math.round((state.correct / state.total) * 100) : 0;
  const tier =
    pct >= 100
      ? { ring: "#22c55e", title: lang === "fr" ? "Score parfait !" : "Perfect score!", sub: lang === "fr" ? "Sans faute, bravo !" : "Flawless — bravo!" }
      : pct >= 80
        ? { ring: "#22c55e", title: lang === "fr" ? "Excellent !" : "Excellent!", sub: lang === "fr" ? "Tu maîtrises ce chapitre." : "You've mastered this chapter." }
        : pct >= 50
          ? { ring: "#f5b400", title: lang === "fr" ? "Bien joué !" : "Well done!", sub: lang === "fr" ? "Bon travail, continue comme ça !" : "Good job, keep it up!" }
          : pct >= 25
            ? { ring: "#f97316", title: lang === "fr" ? "Continue tes efforts !" : "Keep going!", sub: lang === "fr" ? "Revois la leçon et réessaie." : "Review the lesson and try again." }
            : { ring: "#ef4444", title: lang === "fr" ? "Ne lâche rien !" : "Don't give up!", sub: lang === "fr" ? "Reprends la leçon, tu vas y arriver." : "Go back over the lesson — you've got this." };

  return (
    <PhoneFrame>
      <div className="flex-1 min-h-0 overflow-y-auto bg-white px-[26px] pt-[60px] pb-[30px] text-center flex flex-col items-center">
        <div className="w-[130px] h-[130px] rounded-full border-8 flex flex-col items-center justify-center mb-[22px]" style={{ borderColor: tier.ring }}>
          <span className="font-serif font-extrabold text-[30px] text-ink-900">
            {state.correct}/{state.total}
          </span>
        </div>

        <h2 className="font-serif font-bold text-[19px] text-ink-900 mb-2">{tier.title}</h2>
        <p className="text-[13.5px] text-[#647084] mb-6">{tier.sub}</p>

        <div className="bg-[#fff8e5] rounded-[12px] px-[18px] py-3.5 flex items-center gap-2.5 mb-[26px]">
          <div className="w-[22px] h-[22px] rounded-full bg-ochre-600 text-ink-900 text-[11px] font-serif font-extrabold flex items-center justify-center">f</div>
          <span className="font-serif font-bold text-[14px] text-[#7a5200]">+{animCoins} FaxCoins</span>
        </div>

        {state.offline && <div className="text-[11px] text-muted mb-4">{lang === "fr" ? "Hors-ligne — score provisoire" : "Offline — provisional score"}</div>}

        <button
          onClick={() => navigate(`/quiz/${quizId}/correction`, { state })}
          className="w-full bg-white text-brand-500 border-2 border-brand-500 rounded-[10px] py-3.5 font-serif font-bold text-[14px] mb-3"
        >
          {lang === "fr" ? "Voir la correction" : "View correction"}
        </button>
        <button
          onClick={() => navigate(nextHref ?? "/dashboard")}
          className="w-full bg-brand-500 text-white rounded-[10px] py-3.5 font-serif font-bold text-[14px]"
        >
          {nextHref
            ? nextIsLesson
              ? lang === "fr" ? "Leçon suivante" : "Next lesson"
              : lang === "fr" ? "Retour au chapitre" : "Back to chapter"
            : lang === "fr" ? "Continuer" : "Continue"}
        </button>
        {nextHref && (
          <button onClick={() => navigate("/dashboard")} className="w-full py-2.5 mt-1 text-muted text-[13px] font-semibold">
            {lang === "fr" ? "Retour à l'accueil" : "Back to home"}
          </button>
        )}
      </div>
    </PhoneFrame>
  );
}

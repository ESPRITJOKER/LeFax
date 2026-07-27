import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { StatRow } from "../../components/StatRow";
import { Icon } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";

interface ResultState {
  score: number;
  correct: number;
  total: number;
  coinsEarned: number;
  offline?: boolean;
  cohortAvg?: number | null;
  cohortHigh?: number | null;
  cohortLow?: number | null;
}

export default function QuizResult() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { quizId } = useParams<{ quizId: string }>();
  const location = useLocation();
  const state = (location.state as ResultState) ?? { score: 0, correct: 0, total: 0, coinsEarned: 0 };

  const [animCoins, setAnimCoins] = useState(0);
  const cohortAvg = state.cohortAvg ?? null;
  const cohortHigh = state.cohortHigh ?? null;
  const cohortLow = state.cohortLow ?? null;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Where "Continue" goes next in the chapter, once resolved.
  const [nextHref, setNextHref] = useState<string | null>(null);
  const [nextIsLesson, setNextIsLesson] = useState(false);
  const completeRef = useRef(false);

  // When this quiz belongs to a lesson, completing it marks the lesson done
  // (and awards the chapter-complete bonus, server-side via `courses`), then
  // resolves where "Continue" should route next within the chapter.
  useEffect(() => {
    if (!isSupabaseConfigured || !quizId || completeRef.current) return;
    completeRef.current = true;
    (async () => {
      const { data: quizRow } = await supabase.from("quizzes").select("lesson_id").eq("id", quizId).maybeSingle();
      const lessonId = quizRow?.lesson_id;
      if (!lessonId) return; // e.g. a mock-exam quiz — nothing to continue here

      try {
        await supabase.functions.invoke("courses", { body: { action: "complete_lesson", lesson_id: lessonId } });
      } catch {
        // Backend unreachable — the lesson just won't be flagged done yet.
      }

      const { data: lessonRow } = await supabase.from("lessons").select("chapter_id").eq("id", lessonId).maybeSingle();
      if (!lessonRow) return;
      const { data: siblings } = await supabase.from("lessons").select("id").eq("chapter_id", lessonRow.chapter_id).order("position");
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
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [state.coinsEarned]);

  const pct = state.total > 0 ? Math.round((state.correct / state.total) * 100) : 0;
  const showBadge = pct >= 80;

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3">
          <button onClick={() => navigate(-1)} className="p-1">
            <div className="flex flex-col gap-1 w-5">
              <span className="block h-0.5 bg-brand-800 rounded-sm"></span>
              <span className="block h-0.5 bg-brand-800 rounded-sm"></span>
              <span className="block h-0.5 bg-brand-800 rounded-sm"></span>
            </div>
          </button>
          <div className="flex items-center gap-1.5 bg-brand-800 text-white font-bold text-[13px] py-[6px] px-3 rounded-pill">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-ochre-600 text-ink-950 text-[11px] font-extrabold">f</span>
            {animCoins}
          </div>
        </div>

        <div className="px-6 pt-2 pb-6 text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-[16px] bg-gradient-to-br from-[#8BE0A6] to-[#4CAF50] flex items-center justify-center">
            <Icon name="check" size={28} className="text-white" />
          </div>

          <h3 className="text-[15px] font-bold text-text mb-3">{t("result_congrats")}</h3>

          <div className="mb-1">
            <span className="text-[44px] font-extrabold text-text">{state.correct}</span>
            <span className="text-[22px] font-bold text-muted">/{state.total}</span>
          </div>

          <div className="text-xs font-semibold text-muted mb-5">Temps mis : {state.offline ? "—" : "—"}</div>

          <div className="flex flex-col gap-2 mb-4">
            <StatRow label="Moyenne générale" value={cohortAvg !== null ? `${cohortAvg}%` : "—"} />
            <StatRow label="Note la plus haute" value={cohortHigh !== null ? `${cohortHigh}%` : "—"} variant="good" />
            <StatRow label="Note la plus basse" value={cohortLow !== null ? `${cohortLow}%` : "—"} variant="bad" />
          </div>

          <div className="flex items-center justify-center gap-2 bg-ochre-50 px-4 py-2.5 rounded-pill mb-4">
            <Icon name="coin" size={18} className="text-ochre-700" />
            <span className="text-sm font-bold text-ochre-700">{t("result_earned")} +{animCoins}</span>
          </div>

          {showBadge && (
            <div className="flex flex-col items-center gap-1.5 p-4 rounded-2xl bg-ochre-50 mb-4">
              <Icon name="medal" size={26} className="text-ochre-600" />
              <div className="text-xs font-bold text-ochre-700">{t("result_badge")}</div>
              <div className="text-[11.5px] text-ochre-600">Expert</div>
            </div>
          )}

          {state.offline && (
            <div className="text-[11px] text-muted text-center mb-4">{t("backend_banner")}</div>
          )}

          <div className="flex flex-col gap-2.5 mt-4">
            <button
              onClick={() => navigate(`/quiz/${quizId}/correction`, { state })}
              className="w-full py-3.5 rounded-xl border border-border bg-white text-text text-sm font-bold"
            >
              {t("result_seeCorrection")}
            </button>
            <button
              onClick={() => navigate(nextHref ?? "/dashboard")}
              className="w-full py-3.5 rounded-xl border-none bg-brand-600 text-white text-sm font-bold"
            >
              {nextHref
                ? nextIsLesson
                  ? lang === "fr" ? "Leçon suivante" : "Next lesson"
                  : lang === "fr" ? "Retour au chapitre" : "Back to chapter"
                : t("result_backHome")}
            </button>
            {nextHref && (
              <button onClick={() => navigate("/dashboard")} className="w-full py-2 text-muted text-[13px] font-semibold">
                {t("result_backHome")}
              </button>
            )}
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

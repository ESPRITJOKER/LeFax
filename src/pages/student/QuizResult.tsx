import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { Button, RingProgress } from "../../components/ui";
import { Icon } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";

interface ResultState {
  score: number;
  correct: number;
  total: number;
  coinsEarned: number;
  offline?: boolean;
}

export default function QuizResult() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { quizId } = useParams<{ quizId: string }>();
  const location = useLocation();
  const state = (location.state as ResultState) ?? { score: 0, correct: 0, total: 0, coinsEarned: 0 };

  const [animPct, setAnimPct] = useState(0);
  const [animCoins, setAnimCoins] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let p = 0;
    let c = 0;
    timer.current = setInterval(() => {
      p = Math.min(state.score, p + Math.max(1, Math.round(state.score / 28)));
      c = Math.min(state.coinsEarned, c + Math.max(1, Math.round(state.coinsEarned / 20)));
      setAnimPct(p);
      setAnimCoins(c);
      if (p >= state.score && c >= state.coinsEarned && timer.current) clearInterval(timer.current);
    }, 35);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showBadge = state.score >= 80;
  const ringColor = state.score >= 50 ? "var(--color-success-600)" : "var(--color-danger-600)";

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col items-center p-9 px-6.5 px-[26px] overflow-y-auto">
        <div className="font-serif font-bold text-[23px] text-ink-950 mb-5.5 mb-[22px]">{t("result_congrats")}</div>
        <div className="relative" style={{ width: 168, height: 168 }}>
          <RingProgress pct={animPct} size={168} stroke={14} color={ringColor} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[34px] font-extrabold text-ink-900">{animPct}%</div>
            <div className="text-[11px] font-semibold text-muted">{t("result_score")}</div>
          </div>
        </div>

        <div className="mt-5.5 mt-[22px] flex items-center gap-2.5 bg-ochre-50 px-4.5 px-[18px] py-2.5 rounded-pill">
          <Icon name="coin" size={18} className="text-ochre-700" />
          <span className="text-sm font-bold text-ochre-700">
            {t("result_earned")} +{animCoins}
          </span>
        </div>

        {showBadge && (
          <div className="mt-4.5 mt-[18px] flex flex-col items-center gap-1.5 p-4 rounded-2xl bg-ochre-50 w-full">
            <Icon name="medal" size={26} className="text-ochre-600" />
            <div className="text-xs font-bold text-ochre-700">{t("result_badge")}</div>
            <div className="text-[11.5px] text-ochre-600">{lang === "fr" ? "Expert" : "Expert"}</div>
          </div>
        )}

        {state.offline && (
          <div className="mt-4 text-[11px] text-muted text-center">{t("backend_banner")}</div>
        )}

        <div className="flex-1" />
        <div className="flex flex-col gap-2.5 w-full mt-5">
          <Button variant="secondary" onClick={() => navigate(`/quiz/${quizId}/correction`, { state })}>
            {t("result_seeCorrection")}
          </Button>
          <Button onClick={() => navigate("/dashboard")}>{t("result_backHome")}</Button>
        </div>
      </div>
    </PhoneFrame>
  );
}

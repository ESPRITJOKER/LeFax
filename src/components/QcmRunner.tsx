import { useState } from "react";
import { useI18n } from "../lib/i18n";
import type { QuestionRow, ChoiceRow } from "../lib/database.types";

/**
 * Reusable single-answer QCM runner for the chapter *révision* exercises
 * (Exercice Niveau 1/2/3). Visuals are lifted from the graded Quiz screen
 * (src/pages/student/Quiz.tsx) but grading is CLIENT-SIDE off `choices.is_correct`
 * — these are practice rounds, not the Concours-blanc under Evaluations, so
 * there are no hearts, no server scoring and no FaxCoins. `onFinish` reports the
 * raw score so the caller can show a simple result.
 */

export interface QuestionWithChoices extends QuestionRow {
  choices: ChoiceRow[];
}

const LETTERS = ["A", "B", "C", "D", "E"];

export function QcmRunner({
  questions,
  levelLabel,
  levelColor,
  onExit,
  onFinish,
}: {
  questions: QuestionWithChoices[];
  levelLabel: string;
  levelColor: string;
  onExit: () => void;
  onFinish: (correct: number, total: number) => void;
}) {
  const { lang } = useI18n();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const question = questions[index];
  const isLast = index === questions.length - 1;

  function reveal() {
    if (!selected || revealed) return;
    const chosen = question.choices.find((c) => c.id === selected);
    if (chosen?.is_correct) setCorrectCount((n) => n + 1);
    setRevealed(true);
  }

  function next() {
    if (isLast) {
      onFinish(correctCount, questions.length);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setRevealed(false);
  }

  const progressPct = Math.round(((index + (revealed ? 1 : 0)) / questions.length) * 100);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white">
      <div className="px-5 py-4 flex items-center justify-between" style={{ background: levelColor }}>
        <button onClick={onExit} aria-label={lang === "fr" ? "Fermer" : "Close"}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="1.6" />
            <path d="M9 9l6 6M15 9l-6 6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <span className="text-white font-serif font-bold text-[14px]">{levelLabel}</span>
        <span className="text-white/90 font-bold text-[13px]">
          {index + 1}/{questions.length}
        </span>
      </div>

      <div className="h-1 bg-ink-100">
        <div className="h-full transition-[width] duration-300" style={{ width: `${progressPct}%`, background: levelColor }} />
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-[22px] pt-7">
        <p className="font-serif font-semibold text-[17px] text-ink-900 leading-[1.5] text-center mb-6">
          {lang === "fr" ? question.text_fr : question.text_en}
        </p>

        <div className="flex flex-col">
          {question.choices.map((c, ci) => {
            const letter = LETTERS[ci] ?? String(ci + 1);
            const isSelected = selected === c.id;
            const showCorrect = revealed && c.is_correct;
            const showWrong = revealed && !c.is_correct && isSelected;

            let borderColor = "#eef1f5";
            let bgColor = "#fff";
            let circleColor = "#c3cbd6";
            let circleBg = "#fff";
            let circleText = "#94a3b8";
            if (showCorrect) {
              borderColor = "#22c55e";
              bgColor = "#f0fdf4";
              circleColor = "#22c55e";
              circleBg = "#22c55e";
              circleText = "#fff";
            } else if (showWrong) {
              borderColor = "#ef4444";
              bgColor = "#fef2f2";
              circleColor = "#ef4444";
              circleBg = "#ef4444";
              circleText = "#fff";
            } else if (isSelected && !revealed) {
              borderColor = "#29b6f6";
              circleColor = "#29b6f6";
            }

            return (
              <div
                key={c.id}
                onClick={() => {
                  if (!revealed) setSelected(c.id);
                }}
                className="relative flex items-center gap-3.5 rounded-[12px] px-4 py-3.5 mb-3 cursor-pointer border-2"
                style={{ borderColor, background: bgColor }}
              >
                <div
                  className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 border-2"
                  style={{ borderColor: circleColor, background: circleBg, color: circleText }}
                >
                  {letter}
                </div>
                <div className="flex-1 text-[14.5px] text-ink-900 leading-[1.4]">{lang === "fr" ? c.text_fr : c.text_en}</div>
              </div>
            );
          })}
        </div>

        {revealed && (question.explanation_fr || question.explanation_en) && (
          <div className="rounded-lg px-3.5 py-3 mb-4" style={{ background: "#e8f4ff", borderLeft: "4px solid #29b6f6" }}>
            <div className="text-[13px] leading-[1.55] text-ink-800">{lang === "fr" ? question.explanation_fr : question.explanation_en}</div>
          </div>
        )}
      </div>

      <div className="px-5 py-4">
        <button
          onClick={revealed ? next : reveal}
          disabled={!selected}
          className="w-full rounded-[10px] py-[15px] font-serif font-bold text-[14.5px] text-white disabled:opacity-40"
          style={{ background: selected ? levelColor : "#cbd5e1" }}
        >
          {revealed
            ? isLast
              ? lang === "fr"
                ? "Terminer"
                : "Finish"
              : lang === "fr"
                ? "Continuer"
                : "Continue"
            : lang === "fr"
              ? "Vérifier"
              : "Check"}
        </button>
      </div>
    </div>
  );
}

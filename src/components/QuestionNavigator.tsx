import { useI18n } from "../lib/i18n";

/**
 * Question-number grid overlay for the exam-paper player (sujet). Lets the
 * student jump to any question and see at a glance which they've answered.
 *
 *  - answered  → filled blue (brand-500 / #29b6f6), white number
 *  - current   → blue outline
 *  - untouched → light grey cell, muted number
 *
 * Rendered as an absolute overlay inside the PaperQuiz flex column (which lives
 * in PhoneFrame), so it stays pinned to the phone frame. `answered` is a Set of
 * 0-based question indices; cells display 1-based numbers.
 */
export function QuestionNavigator({
  count,
  currentIndex,
  answered,
  onJump,
  onClose,
}: {
  count: number;
  currentIndex: number;
  answered: Set<number>;
  onJump: (index: number) => void;
  onClose: () => void;
}) {
  const { lang } = useI18n();
  const answeredCount = answered.size;

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-black/40" onClick={onClose}>
      <div
        className="mt-auto bg-white rounded-t-[20px] flex flex-col max-h-[82%]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-3.5 pb-3 border-b border-ink-100">
          <div className="flex items-center justify-between">
            <span className="font-serif font-bold text-[15px] text-ink-900">
              {lang === "fr" ? "Toutes les questions" : "All questions"}
            </span>
            <button onClick={onClose} aria-label={lang === "fr" ? "Fermer" : "Close"}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#94a3b8" strokeWidth="1.6" />
                <path d="M9 9l6 6M15 9l-6 6" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="mt-1.5 flex items-center gap-4 text-[11.5px] text-muted">
            <span>
              {lang === "fr" ? "Question" : "Question"} {currentIndex + 1}/{count}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-brand-500 inline-block" />
              {answeredCount} {lang === "fr" ? "répondue(s)" : "answered"}
            </span>
          </div>
        </div>

        <div className="overflow-auto px-5 py-4">
          <div className="grid grid-cols-6 gap-2.5">
            {Array.from({ length: count }, (_, i) => {
              const isCurrent = i === currentIndex;
              const isAnswered = answered.has(i);
              let bg = "#f1f4f8";
              let color = "#64748b";
              let border = "2px solid transparent";
              if (isAnswered) {
                bg = "#29b6f6";
                color = "#fff";
              }
              if (isCurrent) {
                border = "2px solid #1e2a3a";
              }
              return (
                <button
                  key={i}
                  onClick={() => onJump(i)}
                  className="aspect-square rounded-[10px] flex items-center justify-center font-bold text-[13.5px]"
                  style={{ background: bg, color, border }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

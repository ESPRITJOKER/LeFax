import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type QcmDto } from "../../lib/api-client";
import { useSessionStore } from "../../stores/session.store";

const DIFFICULTY_LABELS: Record<string, string> = { easy: "FACILE", intermediate: "INTERMÉDIAIRE", hard: "DIFFICILE" };
const DIFFICULTIES = ["easy", "intermediate", "hard"] as const;

/** Ported from stitch_lefax_course_exam_prep/qcm_practice (WEB-E06). */
export function QcmPracticePage() {
  const { t } = useTranslation();
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const branch = useSessionStore((s) => s.user?.branchPreferences[0]);
  const [qcms, setQcms] = useState<QcmDto[]>([]);
  const [unlocked, setUnlocked] = useState<string[]>(["easy"]);
  const [difficulty, setDifficulty] = useState<string>("easy");
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correctOptionId: string; explanation: string } | null>(null);
  const [session, setSession] = useState({ correct: 0, attempted: 0 });
  const [correctStreak, setCorrectStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const questionStartRef = useRef(Date.now());

  useEffect(() => {
    if (!lessonId) return;
    api.lessonQcms(lessonId).then((res) => {
      setQcms(res.qcms);
      setUnlocked(res.unlockedDifficulties);
      setLoading(false);
    });
  }, [lessonId]);

  useEffect(() => {
    questionStartRef.current = Date.now();
    setElapsedSeconds(0);
    const id = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - questionStartRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [index, difficulty]);

  if (loading) return null;

  const filtered = qcms.filter((q) => q.difficulty === difficulty);
  const current = filtered[index];

  async function selectOption(optionId: string) {
    if (!current || feedback) return;
    setSelected(optionId);
    const res = await api.attemptQcm(current.id, optionId);
    setFeedback({ correctOptionId: res.correctOptionId, explanation: res.explanation });
    setSession((s) => ({ correct: s.correct + (res.isCorrect ? 1 : 0), attempted: s.attempted + 1 }));
    setCorrectStreak((s) => (res.isCorrect ? s + 1 : 0));
  }

  function nextQuestion() {
    setSelected(null);
    setFeedback(null);
    if (index < filtered.length - 1) {
      setIndex(index + 1);
    } else {
      navigate("/app/lessons");
    }
  }

  function switchDifficulty(d: string) {
    if (!unlocked.includes(d)) return;
    setDifficulty(d);
    setIndex(0);
    setSelected(null);
    setFeedback(null);
  }

  const accuracy = session.attempted ? Math.round((session.correct / session.attempted) * 100) : 0;
  const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
  const seconds = String(elapsedSeconds % 60).padStart(2, "0");

  return (
    <div>
      <div className="flex gap-sm mb-lg">
        {DIFFICULTIES.map((d) => {
          const isUnlocked = unlocked.includes(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => switchDifficulty(d)}
              disabled={!isUnlocked}
              className={`flex-1 py-sm rounded-lg font-label-lg text-label-lg transition-all flex items-center justify-center gap-xs ${
                difficulty === d ? "bg-excellence-blue text-white" : "bg-surface-container-low text-on-surface-variant"
              } disabled:opacity-40`}
            >
              {!isUnlocked && <MaterialIcon name="lock" className="text-[16px]" />}
              {DIFFICULTY_LABELS[d]}
            </button>
          );
        })}
      </div>

      {!current ? (
        <p className="font-body-md text-body-md text-text-secondary text-center py-xl">
          Aucun QCM disponible à ce niveau pour cette leçon.
        </p>
      ) : (
        <>
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-label-lg font-label-lg text-text-secondary">
                Question {index + 1} sur {filtered.length}
              </span>
              <span className="text-label-lg font-label-lg text-excellence-blue">{accuracy}% de réussite</span>
            </div>
            <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
              <div
                className="h-full bg-excellence-blue transition-all duration-500"
                style={{ width: `${((index + 1) / filtered.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md mb-gutter shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              {branch && (
                <span className="bg-primary-container text-on-primary-container text-label-md font-label-md px-2 py-0.5 rounded uppercase">
                  {t(`branches.${branch}`)}
                </span>
              )}
              <span className="bg-surface-container-high text-on-surface-variant text-label-md font-label-md px-2 py-0.5 rounded">
                {DIFFICULTY_LABELS[current.difficulty]}
              </span>
            </div>
            <h2 className="text-headline-md font-headline-md text-primary mb-4 leading-relaxed">{current.question}</h2>
          </div>

          <div className="space-y-4 mb-8">
            {current.options.map((option, i) => {
              const isSelected = selected === option.id;
              const isCorrectOption = feedback?.correctOptionId === option.id;
              let stateClasses = "border-outline-variant hover:border-excellence-blue";
              let icon: string | null = null;
              if (feedback) {
                if (isCorrectOption) {
                  stateClasses = "border-2 border-success-green shadow-sm";
                  icon = "check";
                } else if (isSelected) {
                  stateClasses = "border-2 border-error-red";
                  icon = "close";
                } else {
                  stateClasses = "border-outline-variant opacity-60";
                }
              }
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => selectOption(option.id)}
                  disabled={Boolean(feedback)}
                  className={`w-full text-left bg-surface-container-lowest border rounded-xl p-md flex items-start gap-3 transition-all ${stateClasses}`}
                >
                  <div
                    className={`min-w-[32px] h-[32px] rounded-full border flex items-center justify-center text-label-lg font-label-lg ${
                      icon === "check"
                        ? "border-success-green bg-success-green/10 text-success-green"
                        : icon === "close"
                          ? "border-error-red bg-error-container text-error-red"
                          : "border-outline-variant text-text-secondary"
                    }`}
                  >
                    {icon ? <MaterialIcon name={icon} className="text-[20px]" /> : String.fromCharCode(65 + i)}
                  </div>
                  <div className="flex-1">
                    <p className="text-body-md font-body-md text-on-surface">{option.text}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {feedback && (
            <div className="bg-surface-container-low border-l-4 border-excellence-blue rounded-r-xl p-md mb-8">
              <div className="flex items-center gap-2 mb-3">
                <MaterialIcon name="info" filled className="text-excellence-blue" />
                <h3 className="text-headline-md font-headline-md text-excellence-blue">Explication</h3>
              </div>
              <p className="text-body-md font-body-md text-on-surface-variant leading-relaxed">{feedback.explanation}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-gutter">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex flex-col items-center">
              <span className="text-label-md font-label-md text-text-secondary uppercase tracking-wider mb-1">Temps écoulé</span>
              <span className="text-headline-lg font-headline-lg text-primary">
                {minutes}:{seconds}
              </span>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex flex-col items-center">
              <span className="text-label-md font-label-md text-text-secondary uppercase tracking-wider mb-1">Série en cours</span>
              <span className="text-headline-lg font-headline-lg text-success-green flex items-center gap-1">
                {correctStreak} <span className="text-body-sm">🔥</span>
              </span>
            </div>
          </div>

          {feedback && (
            <button
              type="button"
              onClick={nextQuestion}
              className="w-full bg-excellence-blue text-white py-4 rounded-xl font-bold text-body-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg mb-8"
            >
              Question suivante
              <MaterialIcon name="arrow_forward" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

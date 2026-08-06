import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { Spinner } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured, invokeFn } from "../../lib/supabaseClient";
import { selectWithNoRepeat } from "../../lib/practiceBank";
import type { QuizRow, QuestionRow, ChoiceRow } from "../../lib/database.types";

const LETTERS = ["A", "B", "C", "D", "E"];

interface QuestionWithChoices extends QuestionRow {
  choices: ChoiceRow[];
}

interface AnswerState {
  choiceId: string;
  isCorrect: boolean | null;
  isWrong: boolean | null;
}

export default function Quiz() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const { quizId } = useParams<{ quizId: string }>();
  const { profile } = useAuth();

  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [questions, setQuestions] = useState<QuestionWithChoices[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [heartsRemaining, setHeartsRemaining] = useState(3);
  const [answerFailed, setAnswerFailed] = useState(false);

  const finishingRef = useRef(false);
  const heartsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (heartsTimeoutRef.current) clearTimeout(heartsTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !quizId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { data: quizRow } = await supabase.from("quizzes").select("*").eq("id", quizId).maybeSingle();
      setQuiz(quizRow ?? null);

      // The quiz's full question set is the BANK (CDC Step 6). Draw a shuffled
      // subset biased away from what this student has recently seen, so a
      // restart doesn't replay the same questions. Falls back to
      // least-recently-seen when the bank is too small to avoid repeats.
      const { data: poolRows } = await supabase.from("questions").select("*").eq("quiz_id", quizId).order("position");
      const pool = poolRows ?? [];
      const topicId = quizRow?.lesson_id ?? quizId!; // scope exposure per lesson (mock exams: per quiz)
      const selected = await selectWithNoRepeat({
        kind: "mcq",
        topicId,
        userId: profile?.id ?? null,
        pool,
        sessionSize: quizRow?.session_size ?? null,
      });

      const questionIds = selected.map((q) => q.id);
      const { data: choiceRows } = questionIds.length
        ? await supabase.from("choices").select("*").in("question_id", questionIds).order("position")
        : { data: [] };
      const withChoices = selected.map((q) => ({ ...q, choices: (choiceRows ?? []).filter((c) => c.question_id === q.id) }));
      setQuestions(withChoices);

      if (profile) {
        const { data: attempt } = await supabase
          .from("quiz_attempts")
          .insert({ user_id: profile.id, quiz_id: quizId, started_at: new Date().toISOString() })
          .select()
          .single();
        setAttemptId(attempt?.id ?? null);
      }
      setLoading(false);
    })();
  }, [quizId, profile]);

  if (loading)
    return (
      <PhoneFrame>
        <Spinner />
      </PhoneFrame>
    );
  if (!quiz || questions.length === 0)
    return (
      <PhoneFrame>
        <div className="p-6 text-sm text-muted">{isSupabaseConfigured ? (lang === "fr" ? "Une erreur est survenue" : "Something went wrong") : "Backend not configured"}</div>
      </PhoneFrame>
    );

  const question = questions[index];
  const currentAnswer = answers[question.id];
  const selectedChoice = currentAnswer?.choiceId;
  const hasAnswered = currentAnswer?.isCorrect !== null && currentAnswer?.isCorrect !== undefined;
  const isLast = index === questions.length - 1;
  const attemptReady = attemptId !== null;

  async function submitAnswer(choiceId: string) {
    if (!attemptId || !quizId || submitting) return;
    setSubmitting(true);
    setAnswerFailed(false);
    try {
      const { data, error } = await invokeFn("quiz-submit", {
        action: "answer",
        attempt_id: attemptId,
        quiz_id: quizId,
        question_id: question.id,
        choice_id: choiceId,
      });
      if (error) throw error;
      const isCorrect = data.is_correct === true;
      const isWrong = data.is_correct === false;
      const newHearts = data.hearts_remaining ?? heartsRemaining;
      setHeartsRemaining(newHearts);
      setAnswers((prev) => ({ ...prev, [question.id]: { choiceId, isCorrect, isWrong } }));
      if (newHearts <= 0) {
        heartsTimeoutRef.current = setTimeout(() => {
          heartsTimeoutRef.current = null;
          finishQuiz();
        }, 1200);
      }
    } catch (err) {
      const ctx = (err as { context?: Response })?.context;
      if (ctx && typeof ctx.json === "function") {
        ctx.json().then((b: unknown) => console.error("[quiz-submit answer] failed:", ctx.status, b)).catch(() => {});
      } else {
        console.error("[quiz-submit answer] failed:", err);
      }
      setAnswerFailed(true);
    }
    setSubmitting(false);
  }

  function handleContinue() {
    if (hasAnswered) {
      if (isLast || heartsRemaining <= 0) {
        finishQuiz();
      } else {
        setIndex((i) => i + 1);
      }
    } else if (selectedChoice) {
      submitAnswer(selectedChoice);
    }
  }

  async function finishQuiz() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    if (heartsTimeoutRef.current) {
      clearTimeout(heartsTimeoutRef.current);
      heartsTimeoutRef.current = null;
    }
    setSubmitting(true);
    const payload = {
      attempt_id: attemptId,
      quiz_id: quizId,
      answers: questions.map((q) => ({ question_id: q.id, choice_id: answers[q.id]?.choiceId ?? null })),
    };
    try {
      const { data, error } = await invokeFn("quiz-submit", payload);
      if (error) throw error;
      navigate(`/quiz/${quizId}/result`, { state: data });
    } catch {
      const correct = questions.filter((q) => answers[q.id]?.isCorrect === true).length;
      const score = Math.round((correct / questions.length) * 100);
      navigate(`/quiz/${quizId}/result`, {
        state: { score, correct, total: questions.length, coinsEarned: score >= 50 ? 10 : 5, offline: true },
      });
    }
    setSubmitting(false);
  }

  const progressPct = Math.round(((index + (hasAnswered ? 1 : 0)) / questions.length) * 100);
  const continueDisabled = (!selectedChoice && !hasAnswered) || submitting || !attemptReady;

  return (
    <PhoneFrame>
      <div className="flex-1 min-h-0 flex flex-col bg-white">
        <div className="bg-brand-800 px-5 py-4 flex items-center justify-between">
          <button onClick={() => navigate(-1)} aria-label="Close">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="1.6" />
              <path d="M9 9l6 6M15 9l-6 6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <div className="flex items-center gap-1.5 rounded-pill px-3 py-[5px]" style={{ background: "#12203a" }}>
            <span className="w-4 h-4 rounded-full bg-ochre-600 text-ink-900 text-[9px] font-serif font-extrabold flex items-center justify-center">f</span>
            <span className="text-white font-bold text-[13px]">{profile?.faxcoins ?? 0}</span>
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <svg key={i} width="18" height="18" viewBox="0 0 24 24" fill={i < heartsRemaining ? "#ef4444" : "#3a4a63"}>
                <path d="M12 21s-7-4.6-9.5-9C.7 8.4 2.6 5 6 5c2 0 3.5 1.1 4 2.6C10.5 6.1 12 5 14 5c3.4 0 5.3 3.4 3.5 7-2.5 4.4-9.5 9-9.5 9z" />
              </svg>
            ))}
          </div>
        </div>

        <div className="h-1 bg-ink-100">
          <div className="h-full bg-success-600 transition-[width] duration-300" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-[22px] pt-7">
          <p className="font-serif font-semibold text-[17px] text-ink-900 leading-[1.5] text-center mb-6">
            {lang === "fr" ? question.text_fr : question.text_en}
          </p>

          <div className="flex flex-col">
            {question.choices.map((c, ci) => {
              const letter = LETTERS[ci] ?? String(ci + 1);
              const isSelected = selectedChoice === c.id;
              const showCorrect = hasAnswered && c.is_correct;
              const showWrong = hasAnswered && !c.is_correct && isSelected;

              let borderColor = "#eef1f5";
              let bgColor = "#fff";
              let circleColor = "#c3cbd6";
              let circleBg = "#fff";
              let circleText = "#94a3b8";
              let tag = "";
              let tagColor = "";
              if (showCorrect) {
                borderColor = "#22c55e";
                bgColor = "#f0fdf4";
                circleColor = "#22c55e";
                circleBg = "#22c55e";
                circleText = "#fff";
                tag = lang === "fr" ? "Bonne réponse" : "Correct";
                tagColor = "#22c55e";
              } else if (showWrong) {
                borderColor = "#ef4444";
                bgColor = "#fef2f2";
                circleColor = "#ef4444";
                circleBg = "#ef4444";
                circleText = "#fff";
                tag = lang === "fr" ? "Mauvaise réponse" : "Wrong";
                tagColor = "#ef4444";
              } else if (isSelected && !hasAnswered) {
                borderColor = "#29b6f6";
                circleColor = "#29b6f6";
              }

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    if (!hasAnswered && !submitting) {
                      setAnswers((prev) => ({ ...prev, [question.id]: { choiceId: c.id, isCorrect: null, isWrong: null } }));
                    }
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
                  {tag && (
                    <div
                      className="absolute -top-px -right-px text-white text-[10px] font-bold px-2 py-[3px]"
                      style={{ background: tagColor, borderRadius: "0 10px 0 8px" }}
                    >
                      {tag}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="flex gap-1.5 justify-center mb-3.5">
            {questions.map((_, i) => (
              <div
                key={i}
                className="w-[7px] h-[7px] rounded-full"
                style={{ background: i < index ? "#22c55e" : i === index ? "#29b6f6" : "#e2e8f0" }}
              />
            ))}
          </div>
          {answerFailed && !hasAnswered && (
            <div className="text-center text-danger-600 text-xs font-semibold mb-2">
              {lang === "fr" ? "Une erreur est survenue — réessayez" : "Something went wrong — try again"}
            </div>
          )}
          <button
            onClick={handleContinue}
            disabled={continueDisabled}
            className="w-full rounded-[10px] py-[15px] font-serif font-bold text-[14.5px] text-white"
            style={{ background: continueDisabled ? "#cfe8fb" : "#29b6f6" }}
          >
            {!attemptReady
              ? "..."
              : hasAnswered
                ? isLast || heartsRemaining <= 0
                  ? lang === "fr" ? "Terminer" : "Finish"
                  : lang === "fr" ? "Continuer" : "Continue"
                : submitting
                  ? "..."
                  : lang === "fr" ? "Continuer" : "Continue"}
          </button>
        </div>
      </div>
    </PhoneFrame>
  );
}

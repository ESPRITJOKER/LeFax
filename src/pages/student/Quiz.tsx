import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { CoinsBadge } from "../../components/CoinsBadge";
import { HeartsDisplay } from "../../components/HeartsDisplay";
import { LetterCircle } from "../../components/LetterCircle";
import { ProgressDots } from "../../components/ProgressDots";
import { Spinner } from "../../components/ui";
import { Icon } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured, invokeFn } from "../../lib/supabaseClient";
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
  const { t, lang } = useI18n();
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

  // Synchronous guards (refs, not state) against finishQuiz firing twice —
  // once from the hearts-depleted auto-advance timeout and once from a
  // manual tap landing in the same window. React state updates aren't
  // synchronous enough to prevent that race on their own.
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
      const { data: questionRows } = await supabase.from("questions").select("*").eq("quiz_id", quizId).order("position");
      const questionIds = (questionRows ?? []).map((q) => q.id);
      const { data: choiceRows } = questionIds.length
        ? await supabase.from("choices").select("*").in("question_id", questionIds).order("position")
        : { data: [] };
      const withChoices = (questionRows ?? []).map((q) => ({ ...q, choices: (choiceRows ?? []).filter((c) => c.question_id === q.id) }));
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

  if (loading) return <PhoneFrame><Spinner /></PhoneFrame>;
  if (!quiz || questions.length === 0)
    return (
      <PhoneFrame>
        <div className="p-6 text-sm text-muted">{isSupabaseConfigured ? t("common_error") : t("backend_banner")}</div>
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
      // Surface the real cause: supabase-js wraps a non-2xx function response
      // in a FunctionsHttpError whose `.context` is the raw Response.
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

  const completedIndices = Object.keys(answers)
    .filter((qid) => answers[qid]?.isCorrect !== null && answers[qid]?.isCorrect !== undefined)
    .map((qid) => questions.findIndex((q) => q.id === qid));

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col h-full bg-white">
        <div className="flex items-center justify-between bg-brand-800 px-4 py-3">
          <button onClick={() => navigate(-1)} className="flex items-center justify-center w-8 h-8">
            <Icon name="close" size={22} className="text-white" />
          </button>
          <div className="flex items-center gap-3">
            <CoinsBadge balance={profile?.faxcoins ?? 0} />
            <HeartsDisplay total={3} remaining={heartsRemaining} />
          </div>
        </div>

        <div className="px-5 pt-4 pb-2">
          <div className="text-[15px] font-bold text-text leading-[1.4] mb-4">
            {lang === "fr" ? question.text_fr : question.text_en}
          </div>
          <div className="flex flex-col gap-2.5">
            {question.choices.map((c, ci) => {
              const letter = LETTERS[ci] ?? String(ci + 1);
              const isSelected = selectedChoice === c.id;
              const isCorrectAnswer = hasAnswered && currentAnswer?.isCorrect && currentAnswer?.choiceId === c.id;
              const isWrongAnswer = hasAnswered && currentAnswer?.isWrong && currentAnswer?.choiceId === c.id;

              let cardBorder = "border-[#E4E9F0] bg-white";
              if (isCorrectAnswer) cardBorder = "border-success-600 bg-success-600/10";
              else if (isWrongAnswer) cardBorder = "border-danger-600 bg-danger-600/10";
              else if (isSelected) cardBorder = "border-ink-300 bg-ink-50";

              let letterCorrect = false;
              let letterWrong = false;
              if (isCorrectAnswer) letterCorrect = true;
              else if (isWrongAnswer) letterWrong = true;

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    if (!hasAnswered && !submitting) {
                      setAnswers((prev) => ({
                        ...prev,
                        [question.id]: { choiceId: c.id, isCorrect: null, isWrong: null },
                      }));
                    }
                  }}
                  className={`relative cursor-pointer flex items-center gap-3 border-[1.5px] rounded-[12px] px-[14px] py-[13px] ${cardBorder}`}
                >
                  <LetterCircle
                    letter={letter}
                    selected={isSelected && !hasAnswered}
                    correct={letterCorrect}
                    wrong={letterWrong}
                  />
                  <div className="text-[13px] font-semibold text-text">
                    {lang === "fr" ? c.text_fr : c.text_en}
                  </div>
                  {isCorrectAnswer && (
                    <span className="absolute -top-2.5 right-3 text-[9.5px] font-extrabold px-2 py-0.5 rounded-md text-white bg-success-600">
                      {lang === "fr" ? "Bonne réponse" : "Correct"}
                    </span>
                  )}
                  {isWrongAnswer && (
                    <span className="absolute -top-2.5 right-3 text-[9.5px] font-extrabold px-2 py-0.5 rounded-md text-white bg-danger-600">
                      {lang === "fr" ? "Mauvaise réponse" : "Wrong answer"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-auto px-5 pb-2 flex justify-center">
          <ProgressDots total={questions.length} current={index} completed={completedIndices} />
        </div>

        <div className="sticky bottom-0 bg-white px-[22px] py-3">
          {heartsRemaining <= 0 && !hasAnswered ? (
            <div className="text-center text-danger-600 font-bold text-sm py-3.5">
              Plus de vies
            </div>
          ) : (
            <>
              {answerFailed && !hasAnswered && (
                <div className="text-center text-danger-600 text-xs font-semibold mb-2">
                  {t("common_error")} — {lang === "fr" ? "réessayez" : "try again"}
                </div>
              )}
              <button
                disabled={(!selectedChoice && !hasAnswered) || submitting || !attemptReady}
                onClick={handleContinue}
                className="w-full py-3.5 rounded-[12px] bg-[#2F9BEE] text-white text-[14px] font-extrabold disabled:opacity-40"
              >
                {!attemptReady
                  ? "..."
                  : hasAnswered
                    ? isLast || heartsRemaining <= 0
                      ? t("quiz_finish")
                      : t("next")
                    : submitting
                      ? "..."
                      : "Continuer"}
              </button>
            </>
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}

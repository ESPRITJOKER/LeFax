import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { Spinner } from "../../components/ui";
import { QuestionNavigator } from "../../components/QuestionNavigator";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured, invokeFn } from "../../lib/supabaseClient";
import { selectWithNoRepeat } from "../../lib/practiceBank";
import type { QuizRow, QuestionRow, ChoiceRow } from "../../lib/database.types";

const LETTERS = ["A", "B", "C", "D", "E"];

interface QuestionWithChoices extends QuestionRow {
  choices: ChoiceRow[];
}

/**
 * Exam-paper ("sujet") player. Unlike the graded lesson Quiz, a paper is the
 * student's PERSONAL practice: bought once in the Boutique, then replayable any
 * time. Differences from Quiz.tsx:
 *   - the FULL question set is served, reshuffled each attempt;
 *   - FREE navigation (Précédent / Suivant + a jump-anywhere number grid);
 *   - NO hearts and NO per-question reveal — the correction (answers +
 *     explanations) is shown only AFTER finishing, via the reused
 *     /quiz/:quizId/result → /quiz/:quizId/correction screens.
 */
export default function PaperQuiz() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const { quizId } = useParams<{ quizId: string }>();
  const { profile } = useAuth();

  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [questions, setQuestions] = useState<QuestionWithChoices[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // question_id -> choice_id
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const finishingRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !quizId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { data: quizRow } = await supabase.from("quizzes").select("*").eq("id", quizId).maybeSingle();
      setQuiz(quizRow ?? null);

      // A paper serves ALL its questions, reshuffled each attempt (sessionSize =
      // pool length). selectWithNoRepeat degrades to a plain shuffle here.
      const { data: poolRows } = await supabase.from("questions").select("*").eq("quiz_id", quizId).order("position");
      const pool = poolRows ?? [];
      const selected = await selectWithNoRepeat({
        kind: "mcq",
        topicId: quizId!,
        userId: profile?.id ?? null,
        pool,
        sessionSize: pool.length,
        record: false, // a paper always shows every question — don't burn exposure
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
        <div className="p-6 text-sm text-muted">
          {isSupabaseConfigured ? (lang === "fr" ? "Épreuve indisponible" : "Paper unavailable") : "Backend not configured"}
        </div>
      </PhoneFrame>
    );

  const question = questions[index];
  const isLast = index === questions.length - 1;
  const answeredSet = new Set(questions.map((q, i) => (answers[q.id] ? i : -1)).filter((i) => i >= 0));
  const answeredCount = answeredSet.size;

  function select(choiceId: string) {
    setAnswers((prev) => ({ ...prev, [question.id]: choiceId }));
  }

  async function finish() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setSubmitting(true);
    const payload = {
      attempt_id: attemptId,
      quiz_id: quizId,
      answers: questions.map((q) => ({ question_id: q.id, choice_id: answers[q.id] ?? null })),
    };
    try {
      const { data, error } = await invokeFn("quiz-submit", payload);
      if (error) throw error;
      navigate(`/quiz/${quizId}/result`, { state: data });
    } catch {
      const correct = questions.filter((q) => {
        const cid = answers[q.id];
        return cid && q.choices.find((c) => c.id === cid)?.is_correct;
      }).length;
      const score = Math.round((correct / questions.length) * 100);
      navigate(`/quiz/${quizId}/result`, {
        state: { score, correct, total: questions.length, coinsEarned: score >= 50 ? 10 : 5, offline: true },
      });
    }
    setSubmitting(false);
  }

  function requestFinish() {
    if (answeredCount < questions.length) {
      const msg =
        lang === "fr"
          ? `Il te reste ${questions.length - answeredCount} question(s) sans réponse. Terminer quand même ?`
          : `You still have ${questions.length - answeredCount} unanswered question(s). Finish anyway?`;
      if (!window.confirm(msg)) return;
    }
    finish();
  }

  return (
    <PhoneFrame>
      <div className="flex-1 min-h-0 flex flex-col bg-white">
        <div className="bg-brand-800 px-5 py-4 flex items-center justify-between">
          <button onClick={() => navigate(-1)} aria-label={lang === "fr" ? "Fermer" : "Close"}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="1.6" />
              <path d="M9 9l6 6M15 9l-6 6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <span className="text-white font-serif font-bold text-[14px] truncate max-w-[60%]">
            {lang === "fr" ? quiz.title_fr : quiz.title_en}
          </span>
          <span className="text-white/90 font-bold text-[13px]">
            {index + 1}/{questions.length}
          </span>
        </div>

        <button
          onClick={() => setNavOpen(true)}
          className="py-2.5 text-center text-brand-500 font-semibold text-[13px] underline underline-offset-2 border-b border-ink-100"
        >
          {lang === "fr" ? "Voir toutes les questions" : "See all questions"}
        </button>

        <div className="flex-1 min-h-0 overflow-auto px-[22px] pt-6">
          <p className="font-serif font-semibold text-[17px] text-ink-900 leading-[1.5] text-center mb-6">
            {lang === "fr" ? question.text_fr : question.text_en}
          </p>

          <div className="flex flex-col">
            {question.choices.map((c, ci) => {
              const letter = LETTERS[ci] ?? String(ci + 1);
              const isSelected = answers[question.id] === c.id;

              const borderColor = isSelected ? "#29b6f6" : "#eef1f5";
              const circleColor = isSelected ? "#29b6f6" : "#c3cbd6";
              const circleText = isSelected ? "#29b6f6" : "#94a3b8";

              return (
                <div
                  key={c.id}
                  onClick={() => select(c.id)}
                  className="relative flex items-center gap-3.5 rounded-[12px] px-4 py-3.5 mb-3 cursor-pointer border-2"
                  style={{ borderColor, background: "#fff" }}
                >
                  <div
                    className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 border-2"
                    style={{ borderColor: circleColor, background: "#fff", color: circleText }}
                  >
                    {letter}
                  </div>
                  <div className="flex-1 text-[14.5px] text-ink-900 leading-[1.4]">{lang === "fr" ? c.text_fr : c.text_en}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-ink-100">
          <div className="flex gap-2.5">
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="flex-1 rounded-[10px] py-3 font-serif font-bold text-[13.5px] bg-ink-50 text-ink-800 disabled:opacity-40"
            >
              ← {lang === "fr" ? "Précédent" : "Previous"}
            </button>
            {isLast ? (
              <button
                onClick={requestFinish}
                disabled={submitting}
                className="flex-1 rounded-[10px] py-3 font-serif font-bold text-[13.5px] bg-success-600 text-white disabled:opacity-50"
              >
                {submitting ? "..." : lang === "fr" ? "Terminer" : "Finish"}
              </button>
            ) : (
              <button
                onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
                className="flex-1 rounded-[10px] py-3 font-serif font-bold text-[13.5px] bg-brand-500 text-white"
              >
                {lang === "fr" ? "Suivant" : "Next"} →
              </button>
            )}
          </div>
          {!isLast && (
            <button
              onClick={requestFinish}
              disabled={submitting}
              className="w-full mt-2 py-2 text-center text-muted font-semibold text-[12.5px] disabled:opacity-50"
            >
              {lang === "fr" ? "Terminer l'épreuve" : "Finish the paper"}
            </button>
          )}
        </div>
      </div>

      {navOpen && (
        <QuestionNavigator
          count={questions.length}
          currentIndex={index}
          answered={answeredSet}
          onJump={(i) => {
            setIndex(i);
            setNavOpen(false);
          }}
          onClose={() => setNavOpen(false)}
        />
      )}
    </PhoneFrame>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { ScreenHeader } from "../../components/ScreenHeader";
import { ProgressBar, Spinner } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { QuizRow, QuestionRow, ChoiceRow } from "../../lib/database.types";

interface QuestionWithChoices extends QuestionRow {
  choices: ChoiceRow[];
}

export default function Quiz() {
  const { t, lang } = useI18n();
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
  const selectedChoice = answers[question.id];
  const isLast = index === questions.length - 1;

  async function finishQuiz() {
    setSubmitting(true);
    const payload = {
      attempt_id: attemptId,
      quiz_id: quizId,
      answers: questions.map((q) => ({ question_id: q.id, choice_id: answers[q.id] ?? null })),
    };
    try {
      const { data, error } = await supabase.functions.invoke("quiz-submit", { body: payload });
      if (error) throw error;
      navigate(`/quiz/${quizId}/result`, { state: data });
    } catch {
      // Backend not reachable yet — fall back to a client-side estimate so the
      // result screen still has something to animate (clearly a scaffold path).
      const correct = questions.filter((q) => {
        const choice = q.choices.find((c) => c.id === answers[q.id]);
        return choice?.is_correct;
      }).length;
      const score = Math.round((correct / questions.length) * 100);
      navigate(`/quiz/${quizId}/result`, {
        state: { score, correct, total: questions.length, coinsEarned: score >= 50 ? 10 : 5, offline: true },
      });
    }
    setSubmitting(false);
  }

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col overflow-y-auto">
        <ScreenHeader title={lang === "fr" ? quiz.title_fr : quiz.title_en} />
        <div className="px-[22px] pt-3.5 pb-1 text-xs font-bold text-muted">
          {t("quiz_question")} {index + 1}/{questions.length}
        </div>
        <div className="px-[22px] pb-1.5">
          <ProgressBar pct={Math.round(((index + 1) / questions.length) * 100)} color="ink" />
        </div>

        <div className="px-[22px] pt-5 pb-6 flex-1">
          <div className="text-[16.5px] font-bold text-ink-900 leading-snug mb-5.5 mb-[22px]">
            {lang === "fr" ? question.text_fr : question.text_en}
          </div>
          <div className="flex flex-col gap-2.5">
            {question.choices.map((c) => {
              const selected = selectedChoice === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: c.id }))}
                  className={`cursor-pointer flex items-center gap-3 px-[15px] py-3.5 rounded-[13px] border-[1.5px] ${
                    selected ? "border-ink-300 bg-ink-50" : "border-border bg-white"
                  }`}
                >
                  <div
                    className={`w-[19px] h-[19px] flex-none rounded-full border-2 flex items-center justify-center ${
                      selected ? "border-ink-700 bg-ink-700" : "border-border bg-white"
                    }`}
                  >
                    {selected && <div className="w-[9px] h-[9px] rounded-full bg-white" />}
                  </div>
                  <div className="text-[13.5px] font-semibold text-ink-900">{lang === "fr" ? c.text_fr : c.text_en}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-border px-[22px] py-3">
          <button
            disabled={!selectedChoice || submitting}
            onClick={() => (isLast ? finishQuiz() : setIndex((i) => i + 1))}
            className="w-full py-3.5 rounded-xl border-none text-white text-sm font-bold disabled:opacity-40"
            style={{ background: selectedChoice ? "var(--color-ink-700)" : "var(--color-border)" }}
          >
            {isLast ? t("quiz_finish") : t("next")}
          </button>
        </div>
      </div>
    </PhoneFrame>
  );
}

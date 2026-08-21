import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { Spinner } from "../../components/ui";
import { QcmRunner, type QuestionWithChoices } from "../../components/QcmRunner";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { selectWithNoRepeat } from "../../lib/practiceBank";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { DifficultyLevel, QuestionRow, ChoiceRow } from "../../lib/database.types";

// Exercice Niveau 1/2/3 → the rock-rolling difficulty metaphor from the original
// platform: facile (downhill, green) → intermédiaire (amber) → difficile (uphill,
// red). Each maps to a question `difficulty`.
const LEVELS: Record<string, { difficulty: DifficultyLevel; color: string; fr: string; en: string }> = {
  "1": { difficulty: "easy", color: "#22c55e", fr: "Niveau 1 · Facile", en: "Level 1 · Easy" },
  "2": { difficulty: "medium", color: "#f5b400", fr: "Niveau 2 · Intermédiaire", en: "Level 2 · Intermediate" },
  "3": { difficulty: "hard", color: "#ef4444", fr: "Niveau 3 · Difficile", en: "Level 3 · Hard" },
};

const SESSION_SIZE = 10;

export default function ChapterPractice() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const { chapterId, level } = useParams<{ chapterId: string; level: string }>();
  const { profile } = useAuth();

  const meta = LEVELS[level ?? "1"] ?? LEVELS["1"];
  const [questions, setQuestions] = useState<QuestionWithChoices[]>([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<{ correct: number; total: number } | null>(null);
  const [round, setRound] = useState(0); // bump to reload a fresh subset on "Rejouer"

  useEffect(() => {
    if (!isSupabaseConfigured || !chapterId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setResult(null);

      const { data: lessonRows } = await supabase.from("lessons").select("id").eq("chapter_id", chapterId).eq("published", true);
      const lessonIds = (lessonRows ?? []).map((l) => l.id);
      const { data: quizRows } = lessonIds.length
        ? await supabase.from("quizzes").select("id").in("lesson_id", lessonIds)
        : { data: [] as { id: string }[] };
      const quizIds = (quizRows ?? []).map((q) => q.id);
      const { data: questionRows } = quizIds.length
        ? await supabase.from("questions").select("*").in("quiz_id", quizIds).order("position")
        : { data: [] as QuestionRow[] };
      const allQuestions = (questionRows ?? []) as QuestionRow[];

      // Prefer this level's difficulty tier. But if the tier is too thin to fill
      // a session, draw from the whole chapter bank so no level is ever
      // near-empty — every QCM stays reachable at every level (2026-08-22).
      let pool = allQuestions.filter((q) => q.difficulty === meta.difficulty);
      if (pool.length < SESSION_SIZE) pool = allQuestions;

      const selected = await selectWithNoRepeat({
        kind: "mcq",
        topicId: `${chapterId}:L${level}`,
        userId: profile?.id ?? null,
        pool,
        sessionSize: SESSION_SIZE,
      });

      const questionIds = selected.map((q) => q.id);
      const { data: choiceRows } = questionIds.length
        ? await supabase.from("choices").select("*").in("question_id", questionIds).order("position")
        : { data: [] as ChoiceRow[] };
      const withChoices: QuestionWithChoices[] = selected.map((q) => ({
        ...q,
        choices: (choiceRows ?? []).filter((c) => c.question_id === q.id),
      }));
      setQuestions(withChoices);
      setLoading(false);
    })();
  }, [chapterId, level, profile, round, meta.difficulty]);

  if (loading)
    return (
      <PhoneFrame>
        <Spinner />
      </PhoneFrame>
    );

  const backToChapter = () => navigate(-1);

  if (questions.length === 0)
    return (
      <PhoneFrame>
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-[14px] text-muted">
            {lang === "fr" ? "Aucun exercice disponible pour ce niveau pour le moment." : "No exercises available for this level yet."}
          </p>
          <button onClick={backToChapter} className="bg-brand-600 text-white font-bold text-[14px] px-6 py-3 rounded-xl">
            {lang === "fr" ? "Retour" : "Back"}
          </button>
        </div>
      </PhoneFrame>
    );

  if (result) {
    const pct = Math.round((result.correct / result.total) * 100);
    return (
      <PhoneFrame>
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-1" style={{ background: meta.color }}>
            <span className="text-white font-serif font-extrabold text-[22px]">{pct}%</span>
          </div>
          <h2 className="font-serif font-extrabold text-[19px] text-ink-900">
            {lang === "fr" ? "Exercice terminé" : "Exercise complete"}
          </h2>
          <p className="text-[14px] text-muted">
            {result.correct}/{result.total} {lang === "fr" ? "bonnes réponses" : "correct"}
          </p>
          <div className="flex gap-3 mt-3">
            <button onClick={() => setRound((r) => r + 1)} className="bg-brand-600 text-white font-bold text-[14px] px-5 py-3 rounded-xl">
              {lang === "fr" ? "Rejouer" : "Play again"}
            </button>
            <button onClick={backToChapter} className="bg-ink-100 text-ink-900 font-bold text-[14px] px-5 py-3 rounded-xl">
              {lang === "fr" ? "Retour" : "Back"}
            </button>
          </div>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <QcmRunner
        key={round}
        questions={questions}
        levelLabel={lang === "fr" ? meta.fr : meta.en}
        levelColor={meta.color}
        onExit={backToChapter}
        onFinish={(correct, total) => setResult({ correct, total })}
      />
    </PhoneFrame>
  );
}

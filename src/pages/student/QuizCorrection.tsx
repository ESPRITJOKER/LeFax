import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { TopBar } from "../../components/TopBar";
import { Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";

interface CorrectionItem {
  index: number;
  question: string;
  yourAnswer: string;
  correctAnswer: string;
  explanation: string;
  correct: boolean;
}

export default function QuizCorrection() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const { quizId } = useParams<{ quizId: string }>();
  const { profile } = useAuth();

  const [items, setItems] = useState<CorrectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !quizId || !profile) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { data: attempt } = await supabase
        .from("quiz_attempts")
        .select("id")
        .eq("quiz_id", quizId)
        .eq("user_id", profile.id)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!attempt) {
        setLoading(false);
        return;
      }

      const { data: answers } = await supabase.from("student_answers").select("*").eq("attempt_id", attempt.id);
      const { data: questions } = await supabase.from("questions").select("*").eq("quiz_id", quizId).order("position");
      const questionIds = (questions ?? []).map((q) => q.id);
      const { data: choices } = questionIds.length
        ? await supabase.from("choices").select("*").in("question_id", questionIds)
        : { data: [] };

      const built = (questions ?? []).map((q, i) => {
        const answer = (answers ?? []).find((a) => a.question_id === q.id);
        const yourChoice = (choices ?? []).find((c) => c.id === answer?.choice_id);
        const correctChoice = (choices ?? []).find((c) => c.question_id === q.id && c.is_correct);
        return {
          index: i + 1,
          question: lang === "fr" ? q.text_fr : q.text_en,
          yourAnswer: yourChoice ? (lang === "fr" ? yourChoice.text_fr : yourChoice.text_en) : lang === "fr" ? "Sans réponse" : "No answer",
          correctAnswer: correctChoice ? (lang === "fr" ? correctChoice.text_fr : correctChoice.text_en) : "",
          explanation: (lang === "fr" ? q.explanation_fr : q.explanation_en) ?? "",
          correct: Boolean(answer?.is_correct),
        };
      });
      setItems(built);
      setLoading(false);
    })();
  }, [quizId, profile, lang]);

  return (
    <PhoneFrame>
      <div className="flex-1 min-h-0 flex flex-col bg-white">
        <TopBar variant="title" title={lang === "fr" ? "Correction" : "Correction"} onBack={() => navigate(-1)} />
        <div className="flex-1 min-h-0 overflow-auto px-5 pt-4 pb-6">
          {loading ? (
            <Spinner />
          ) : items.length === 0 ? (
            <EmptyState label={isSupabaseConfigured ? (lang === "fr" ? "Aucune correction" : "No correction") : "Backend not configured"} />
          ) : (
            items.map((ci) => (
              <div key={ci.index} className="border border-ink-100 rounded-[12px] px-4 py-3.5 mb-3">
                <div className="flex gap-2 items-start mb-2.5">
                  <div
                    className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
                    style={{ background: ci.correct ? "#22c55e" : "#ef4444" }}
                  >
                    {ci.correct ? (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                        <path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                        <path d="M6 6l12 12M18 6L6 18" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                    )}
                  </div>
                  <div className="text-[13.5px] font-semibold text-ink-900 leading-[1.4]">
                    {ci.index}. {ci.question}
                  </div>
                </div>
                <div className="text-[12.5px] text-success-600 font-semibold mb-0.5 pl-7">✓ {ci.correctAnswer}</div>
                {!ci.correct && <div className="text-[12.5px] text-danger-600 font-semibold mb-1.5 pl-7">✕ {ci.yourAnswer}</div>}
                {ci.explanation && <div className="text-[12px] text-[#647084] pl-7 leading-[1.5]">{ci.explanation}</div>}
              </div>
            ))
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}

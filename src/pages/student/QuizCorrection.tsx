import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { ScreenHeader } from "../../components/ScreenHeader";
import { Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";

interface CorrectionItem {
  index: number;
  question: string;
  yourAnswer: string;
  correctAnswer: string;
  correct: boolean;
}

export default function QuizCorrection() {
  const { t, lang } = useI18n();
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
          correct: Boolean(answer?.is_correct),
        };
      });
      setItems(built);
      setLoading(false);
    })();
  }, [quizId, profile, lang]);

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col overflow-y-auto">
        <ScreenHeader title={t("corr_title")} onBack={() => navigate(-1)} />
        <div className="px-[22px] pt-4 pb-6 flex flex-col gap-3.5">
          {loading ? (
            <Spinner />
          ) : items.length === 0 ? (
            <EmptyState label={isSupabaseConfigured ? t("common_error") : t("backend_banner")} />
          ) : (
            items.map((ci) => (
              <div
                key={ci.index}
                className={`p-3.5 rounded-[13px] border-[1.5px] ${
                  ci.correct ? "border-success-100 bg-success-50" : "border-danger-100 bg-danger-50"
                }`}
              >
                <div className="text-[13px] font-bold text-ink-900 mb-2">
                  {ci.index}. {ci.question}
                </div>
                <div className={`text-xs font-semibold ${ci.correct ? "text-success-600" : "text-danger-700"}`}>
                  {t("corr_yourAnswer")}: {ci.yourAnswer}
                </div>
                {!ci.correct && (
                  <div className="text-xs font-semibold text-success-600 mt-0.5">
                    {t("corr_correctAnswer")}: {ci.correctAnswer}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}

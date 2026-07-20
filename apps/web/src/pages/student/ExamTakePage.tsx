import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type ExamDetailDto } from "../../lib/api-client";

/**
 * No Stitch design covers the exam-taking screen itself (only the intro
 * mockup set the leaderboard result) — built from tokens. Server clock is
 * authoritative for the deadline (NFR-08); this countdown is display-only.
 */
export function ExamTakePage() {
  const { t } = useTranslation();
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<ExamDetailDto | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!examId) return;
    api.startExam(examId).then(() => {
      api.exam(examId).then((res) => {
        setExam(res.exam);
        const deadline = new Date(res.exam.opens_at).getTime() + res.exam.duration_seconds * 1000;
        setRemainingSeconds(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
        setLoading(false);
      });
    });
  }, [examId]);

  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const id = setInterval(() => setRemainingSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [remainingSeconds]);

  async function submit() {
    if (!examId) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.submitExam(examId, answers);
      navigate(`/app/exams/${examId}/leaderboard`);
    } catch {
      setError(t("examTake.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;
  if (!exam) return <p className="font-body-md text-body-md text-text-secondary text-center py-xl">{t("examCommon.notFound")}</p>;

  const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, "0");
  const seconds = String(remainingSeconds % 60).padStart(2, "0");

  return (
    <div className="max-w-[720px] mx-auto">
      <div className="sticky top-16 z-10 bg-background py-sm flex items-center justify-between mb-lg border-b border-outline-variant">
        <h1 className="font-headline-md font-headline-md text-excellence-blue">{exam.title}</h1>
        <span className="font-headline-md font-headline-md text-primary bg-secondary-container px-md py-xs rounded-lg">
          {minutes}:{seconds}
        </span>
      </div>

      <div className="flex flex-col gap-md mb-lg">
        {exam.questions.map((q, i) => (
          <div key={q.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md">
            <p className="font-body-md font-body-md text-primary mb-sm">
              {i + 1}. {q.question}
            </p>
            <div className="flex flex-col gap-xs">
              {q.options.map((option) => (
                <label key={option.id} className="flex items-center gap-sm p-sm rounded-lg hover:bg-surface-container-low cursor-pointer">
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === option.id}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: option.id }))}
                  />
                  <span className="text-body-sm font-body-sm">{option.text}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="font-label-md text-label-md text-error-red mb-sm">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={submitting || remainingSeconds <= 0}
        className="w-full bg-excellence-blue text-white py-4 rounded-xl font-bold text-body-lg flex items-center justify-center gap-2 shadow-lg mb-8 disabled:opacity-50"
      >
        {submitting ? t("examTake.sending") : t("examTake.submit")}
        <MaterialIcon name="send" />
      </button>
    </div>
  );
}

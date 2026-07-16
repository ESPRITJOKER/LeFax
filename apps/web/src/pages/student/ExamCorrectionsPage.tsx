import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type ExamCorrectionDto } from "../../lib/api-client";

/** WEB-E10 "Résultats détaillés" — no dedicated Stitch screen; built from tokens, reusing qcm_practice's answer-review visual language. */
export function ExamCorrectionsPage() {
  const { examId } = useParams<{ examId: string }>();
  const [corrections, setCorrections] = useState<ExamCorrectionDto[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!examId) return;
    api
      .examCorrections(examId)
      .then((res) => {
        setCorrections(res.corrections);
        setScore(res.score);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [examId]);

  if (loading) return null;
  if (error) {
    return (
      <p className="font-body-md text-body-md text-text-secondary text-center py-xl">
        Corrections indisponibles — vous n'avez pas encore soumis ce concours.
      </p>
    );
  }

  return (
    <div className="max-w-[720px] mx-auto">
      <div className="mb-lg">
        <h1 className="font-headline-lg text-headline-lg text-excellence-blue">Corrections</h1>
        {score !== null && <p className="font-body-md text-body-md text-text-secondary">Score final : {score}%</p>}
      </div>

      <div className="flex flex-col gap-md">
        {corrections.map((c, i) => (
          <div key={c.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md">
            <p className="font-body-md font-body-md text-primary mb-sm">
              {i + 1}. {c.question}
            </p>
            <div className="flex flex-col gap-xs mb-sm">
              {c.options.map((option) => {
                const isCorrect = option.id === c.correctOptionId;
                const isStudentAnswer = option.id === c.studentAnswerId;
                let cls = "border-outline-variant";
                if (isCorrect) cls = "border-2 border-success-green bg-success-green/5";
                else if (isStudentAnswer) cls = "border-2 border-error-red bg-error-container/20";
                return (
                  <div key={option.id} className={`flex items-center gap-sm p-sm rounded-lg border ${cls}`}>
                    {isCorrect && <MaterialIcon name="check" className="text-success-green text-[18px]" />}
                    {!isCorrect && isStudentAnswer && <MaterialIcon name="close" className="text-error-red text-[18px]" />}
                    <span className="text-body-sm font-body-sm">{option.text}</span>
                  </div>
                );
              })}
            </div>
            <div className="bg-surface-container-low border-l-4 border-excellence-blue rounded-r-lg p-sm">
              <p className="text-body-sm font-body-sm text-on-surface-variant">{c.explanation}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

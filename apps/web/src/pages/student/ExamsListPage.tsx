import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type ExamDto } from "../../lib/api-client";

/** No matching Stitch design for the list itself — built from tokens (WEB-E09). */
export function ExamsListPage() {
  const { t, i18n } = useTranslation();
  const statusLabels: Record<string, string> = {
    scheduled: t("examsList.status.scheduled"),
    open: t("examsList.status.open"),
    closed: t("examsList.status.closed"),
    scored: t("examsList.status.scored"),
  };
  const [exams, setExams] = useState<ExamDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.exams().then((res) => {
      setExams(res.exams);
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-excellence-blue mb-lg">{t("examsList.title")}</h1>
      {exams.length === 0 ? (
        <p className="font-body-md text-body-md text-text-secondary text-center py-xl">{t("examsList.empty")}</p>
      ) : (
        <div className="flex flex-col gap-sm">
          {exams.map((exam) => (
            <div key={exam.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md">
              <div className="flex items-center justify-between mb-xs">
                <p className="font-label-lg text-label-lg text-primary">{exam.title}</p>
                <span className="text-label-md font-label-md text-text-secondary">{statusLabels[exam.status]}</span>
              </div>
              <p className="font-body-sm text-body-sm text-text-secondary mb-sm">
                {new Date(exam.opens_at).toLocaleString(i18n.language.startsWith("fr") ? "fr-FR" : "en-US")} •{" "}
                {t("common.minutes", { count: Math.round(exam.duration_seconds / 60) })}
              </p>
              <div className="flex gap-sm">
                {exam.status === "open" && (
                  <Link to={`/app/exams/${exam.id}/take`} className="text-label-md font-label-md text-white bg-excellence-blue px-md py-xs rounded-lg flex items-center gap-xs">
                    <MaterialIcon name="play_arrow" className="text-[16px]" />
                    {t("examsList.takeExam")}
                  </Link>
                )}
                <Link to={`/app/exams/${exam.id}/leaderboard`} className="text-label-md font-label-md text-action-blue px-md py-xs flex items-center gap-xs">
                  <MaterialIcon name="leaderboard" className="text-[16px]" />
                  {t("examsList.leaderboard")}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

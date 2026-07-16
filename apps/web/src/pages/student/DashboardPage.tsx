import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type StudentDashboardDto } from "../../lib/api-client";
import { useSessionStore } from "../../stores/session.store";

const REWARD_ICONS: Record<string, string> = {
  lesson_complete: "check_circle",
  lesson_perfect_qcm: "workspace_premium",
  exam_participation: "event_available",
  exam_top10: "military_tech",
  paper_unlock: "shopping_bag",
};

const REWARD_SUBTITLES: Record<string, string> = {
  lesson_complete: "lesson_complete_desc",
  lesson_perfect_qcm: "lesson_perfect_qcm_desc",
  exam_participation: "exam_participation_desc",
  exam_top10: "exam_top10_desc",
  paper_unlock: "paper_unlock_desc",
};

function useCountdown(targetIso: string | undefined) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!targetIso) return;
    const update = () => setRemaining(Math.max(0, new Date(targetIso).getTime() - Date.now()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    mins: Math.floor((totalSeconds % 3600) / 60),
    secs: totalSeconds % 60,
  };
}

/** Ported from stitch_lefax_course_exam_prep/student_dashboard (WEB-E03). Every number is real — see api-client.studentDashboard. */
export function StudentDashboardPage() {
  const { t } = useTranslation();
  const rewardLabels: Record<string, string> = {
    lesson_complete: t("studentDashboard.reward.lessonComplete"),
    lesson_perfect_qcm: t("studentDashboard.reward.lessonPerfectQcm"),
    exam_participation: t("studentDashboard.reward.examParticipation"),
    exam_top10: t("studentDashboard.reward.examTop10"),
    paper_unlock: t("studentDashboard.reward.paperUnlock"),
  };
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const branch = user?.branchPreferences[0];
  const [data, setData] = useState<StudentDashboardDto | null>(null);

  useEffect(() => {
    api.studentDashboard().then(setData);
  }, []);

  const countdown = useCountdown(data?.upcomingExam?.opens_at);

  if (!data) return null;

  const streakBars = Array.from({ length: 6 }, (_, i) => i < data.streakDays);

  return (
    <div>
      <section className="mb-lg flex justify-between items-end">
        <div>
          <p className="text-label-md font-label-md text-text-secondary">
            {t("studentDashboard.welcome", { firstName: data.firstName ?? user?.phone ?? "" })}
          </p>
          <h2 className="text-headline-lg font-headline-lg text-excellence-blue">
            {branch ? t("studentDashboard.readyQuestion", { school: t(`branches.${branch}`) }) : ""}
          </h2>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span className="text-label-md font-label-md text-text-secondary uppercase tracking-widest">
            {t("studentDashboard.streak")}
          </span>
          <div className="flex gap-1">
            {streakBars.map((filled, i) => (
              <div key={i} className={`w-2 h-6 rounded-full ${filled ? "bg-excellence-blue" : "bg-excellence-blue/20"}`} />
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-md mb-lg">
        <div className="col-span-1 bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <MaterialIcon name="menu_book" className="text-excellence-blue" />
            {data.lessonsCompletedToday > 0 && (
              <span className="text-label-md font-label-md text-success-green bg-success-green/10 px-2 py-0.5 rounded-full">
                {t("studentDashboard.todayBadge", { count: data.lessonsCompletedToday })}
              </span>
            )}
          </div>
          <div>
            <p className="text-display-lg font-display-lg text-primary">{data.lessonsCompleted}</p>
            <p className="text-label-md font-label-md text-text-secondary">{t("studentDashboard.lessonsCompleted")}</p>
          </div>
        </div>
        <div className="col-span-1 bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <MaterialIcon name="insights" className="text-excellence-blue" />
            {data.qcmAccuracy !== null && data.qcmAccuracy >= 80 && (
              <span className="text-label-md font-label-md text-action-blue">
                Top {100 - data.qcmAccuracy}%
              </span>
            )}
          </div>
          <div>
            <p className="text-display-lg font-display-lg text-primary">
              {data.qcmAccuracy === null ? "—" : `${data.qcmAccuracy}%`}
            </p>
            <p className="text-label-md font-label-md text-text-secondary">
              {data.qcmAccuracy === null ? t("studentDashboard.noAccuracyYet") : t("studentDashboard.qcmAccuracy")}
            </p>
          </div>
        </div>

        <div className="col-span-2 bg-primary text-on-primary rounded-xl p-md flex items-center justify-between overflow-hidden relative">
          <div className="relative z-10">
            <p className="text-label-md font-label-md text-on-primary-container opacity-80 uppercase tracking-widest">
              {t("studentDashboard.globalRanking")}
            </p>
            {data.rank ? (
              <>
                <p className="text-display-lg font-display-lg">
                  #{data.rank} <span className="text-body-md font-body-md opacity-70">{t("studentDashboard.rankOf", { total: data.totalStudents })}</span>
                </p>
                <p className="text-body-sm font-body-sm mt-1">{t("studentDashboard.rankSubtitle")}</p>
              </>
            ) : (
              <p className="text-body-md font-body-md mt-1 max-w-[220px]">{t("studentDashboard.notRankedYet")}</p>
            )}
          </div>
          {data.rank && (
            <div className="relative z-10 w-16 h-16 bg-achievement-gold/20 rounded-full flex items-center justify-center border border-achievement-gold/30">
              <MaterialIcon name="military_tech" filled className="text-achievement-gold text-4xl" />
            </div>
          )}
          <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-excellence-blue border border-white/5 rounded-full opacity-30" />
        </div>
      </section>

      <section className="mb-lg">
        <h3 className="text-label-lg font-label-lg text-primary mb-sm flex items-center gap-xs">
          <MaterialIcon name="bolt" className="text-sm" />
          {t("studentDashboard.whatsNext")}
        </h3>
        {data.nextLesson ? (
          <div className="bg-surface-container-lowest border-2 border-primary rounded-xl overflow-hidden">
            <div className="p-md flex items-start gap-md">
              <div className="w-12 h-12 bg-surface-container-low rounded-lg flex items-center justify-center shrink-0">
                <MaterialIcon name="menu_book" className="text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="text-headline-md font-headline-md text-excellence-blue">{data.nextLesson.title}</h4>
                <div className="mt-md flex items-center gap-md">
                  <button
                    type="button"
                    onClick={() => navigate(`/app/lessons/${data.nextLesson!.id}`)}
                    className="bg-excellence-blue text-white px-lg py-sm rounded-lg font-label-lg text-label-lg active:scale-95 transition-all shadow-sm"
                  >
                    {t("studentDashboard.startLesson")}
                  </button>
                  {data.nextLesson.estimatedMinutes && (
                    <span className="text-label-md font-label-md text-text-secondary flex items-center gap-1">
                      <MaterialIcon name="schedule" className="text-sm" />
                      {t("studentDashboard.minutesShort", { count: data.nextLesson.estimatedMinutes })}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {data.nextLesson.chapterName && (
              <div className="bg-surface-container-low px-md py-sm flex justify-between items-center border-t border-outline-variant">
                <span className="text-label-md font-label-md text-on-surface-variant">
                  {t("studentDashboard.chapterLabel", { name: data.nextLesson.chapterName })}
                </span>
                {data.nextLesson.cardsTotal > 0 && (
                  <span className="text-label-md font-label-md text-on-surface-variant">
                    {t("studentDashboard.stepOf", { seen: data.nextLesson.cardsSeen, total: data.nextLesson.cardsTotal })}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="font-body-sm text-body-sm text-text-secondary">{t("studentDashboard.noNextLesson")}</p>
        )}
      </section>

      <section className="mb-lg">
        <div className="bg-secondary-container text-on-secondary-container rounded-xl p-md shadow-sm">
          <div className="flex items-center gap-sm mb-md">
            <MaterialIcon name="event" />
            <h3 className="font-headline-md text-headline-md">{t("studentDashboard.weeklyExam")}</h3>
          </div>
          {data.upcomingExam ? (
            <>
              <p className="font-label-lg text-label-lg mb-md">{data.upcomingExam.title}</p>
              <div className="grid grid-cols-4 gap-sm">
                {[
                  [countdown.days, t("studentDashboard.days")],
                  [countdown.hours, t("studentDashboard.hours")],
                  [countdown.mins, t("studentDashboard.mins")],
                  [countdown.secs, t("studentDashboard.secs")],
                ].map(([value, label], i) => (
                  <div key={i} className="bg-white/20 rounded-lg p-2 text-center">
                    <p className="text-headline-md font-headline-md">{String(value).padStart(2, "0")}</p>
                    <p className="text-[10px] uppercase font-label-md">{label}</p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => navigate("/app/exams")}
                className="w-full mt-md py-sm bg-white text-on-secondary-container rounded-lg font-label-lg text-label-lg border border-on-secondary-container/10 active:scale-[0.98] transition-transform"
              >
                {t("studentDashboard.setReminder")}
              </button>
            </>
          ) : (
            <p className="font-body-sm text-body-sm">{t("studentDashboard.noExamScheduled")}</p>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-label-lg font-label-lg text-primary mb-sm">{t("studentDashboard.latestRewards")}</h3>
        {data.recentRewards.length === 0 ? (
          <p className="font-body-sm text-body-sm text-text-secondary">{t("studentDashboard.noRewardsYet")}</p>
        ) : (
          <div className="space-y-sm">
            {data.recentRewards.map((reward) => (
              <div
                key={reward.id}
                className="bg-surface-container-lowest border border-outline-variant rounded-xl p-sm flex items-center gap-md"
              >
                <div className="w-10 h-10 rounded-full bg-achievement-gold/10 flex items-center justify-center">
                  <MaterialIcon name={REWARD_ICONS[reward.reason] ?? "stars"} filled className="text-achievement-gold" />
                </div>
                <div className="flex-1">
                  <p className="text-label-lg font-label-lg text-primary">{rewardLabels[reward.reason] ?? reward.reason}</p>
                  {REWARD_SUBTITLES[reward.reason] && (
                    <p className="text-label-md font-label-md text-text-secondary">{t(`studentDashboard.reward.${REWARD_SUBTITLES[reward.reason]}`)}</p>
                  )}
                </div>
                <div className="ml-auto text-achievement-gold font-label-lg">+{reward.amount} FaxCoins</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

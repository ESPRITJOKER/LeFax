import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type ExamDto, type LeaderboardEntryDto } from "../../lib/api-client";

const RANK_ACCENT: Record<number, string> = {
  1: "border-achievement-gold",
  2: "border-slate-300",
  3: "border-orange-300",
};

/** Ported from stitch_lefax_course_exam_prep/mock_exam_leaderboard (WEB-E10). */
export function ExamLeaderboardPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<ExamDto | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    if (!examId) return;
    Promise.all([api.exam(examId), api.examLeaderboard(examId)]).then(([examRes, lbRes]) => {
      setExam(examRes.exam);
      setLeaderboard(lbRes.leaderboard);
      setFetchedAt(Date.now());
      setLoading(false);
    });
  }, [examId]);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  if (loading) return null;
  if (!exam) return <p className="font-body-md text-body-md text-text-secondary text-center py-xl">Concours introuvable.</p>;

  const me = leaderboard.find((e) => e.isMe);
  // Reward rules mirror the fixed constants used server-side (+15
  // participation, +30 top 10) — a real, exact figure, not an estimate.
  const coinsEarned = me ? 15 + (me.rank <= 10 ? 30 : 0) : null;
  const minutesAgo = Math.max(0, Math.round((nowTick - fetchedAt) / 60000));

  return (
    <div>
      <section className="mb-lg">
        <div className="bg-excellence-blue text-white rounded-xl p-md shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 opacity-10 translate-x-10 -translate-y-10 border-[16px] border-white rounded-full" />
          <div className="relative z-10">
            <p className="text-label-md font-label-md text-on-primary-container uppercase tracking-widest mb-base">
              {exam.status === "closed" || exam.status === "scored" ? "Terminé" : "En cours"}
            </p>
            <h2 className="text-headline-lg font-headline-lg mb-md leading-tight">{exam.title}</h2>
            <div className="flex flex-col gap-sm">
              {coinsEarned !== null && (
                <div className="flex items-center gap-sm bg-white/10 w-fit px-md py-sm rounded-lg backdrop-blur-sm border border-white/10">
                  <MaterialIcon name="stars" filled className="text-achievement-gold" />
                  <span className="text-body-md font-body-md">
                    Vous avez gagné <span className="font-bold">+{coinsEarned} FaxCoins</span>
                  </span>
                </div>
              )}
              {me && (
                <div className="flex items-center gap-sm">
                  <MaterialIcon name="leaderboard" className="text-on-primary-container" />
                  <span className="text-body-md font-body-md">
                    Votre rang : <span className="font-bold text-secondary-container">{me.rank}e</span>{" "}
                    <span className="text-on-primary-container">({me.score}%)</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="flex gap-md mb-lg">
        <button
          type="button"
          onClick={() => navigate(`/app/exams/${examId}/corrections`)}
          className="flex-1 bg-excellence-blue text-white font-label-lg text-label-lg py-md rounded-xl shadow-md active:scale-95 transition-transform flex items-center justify-center gap-sm"
        >
          Revoir les corrections
          <MaterialIcon name="arrow_forward" />
        </button>
      </div>

      <div className="flex items-center justify-between mb-md">
        <h3 className="text-headline-md font-headline-md text-primary">Classement</h3>
        <span className="text-label-md font-label-md text-text-secondary">
          {minutesAgo === 0 ? "Mis à jour à l'instant" : `Mis à jour il y a ${minutesAgo} min`}
        </span>
      </div>

      {leaderboard.length === 0 ? (
        <p className="font-body-md text-body-md text-text-secondary text-center py-xl">
          Aucune soumission notée pour le moment.
        </p>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl divide-y divide-outline-variant overflow-hidden">
          {leaderboard.map((entry) => (
            <div
              key={entry.studentId}
              className={`flex items-center gap-md p-md transition-colors ${
                entry.isMe ? "bg-secondary-container/20" : "hover:bg-surface-container-low"
              }`}
            >
              {entry.rank <= 3 ? (
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center border-2 ${RANK_ACCENT[entry.rank]} bg-surface-container-low text-primary font-label-lg text-label-lg shrink-0`}
                >
                  {entry.rank}
                </div>
              ) : (
                <span className="text-label-lg font-label-lg text-text-secondary w-9 text-center shrink-0">{entry.rank}</span>
              )}
              <div className="flex-1">
                <p className="text-label-lg font-label-lg text-primary">
                  {entry.firstName}
                  {entry.isMe && <span className="text-label-md font-label-md text-text-secondary"> (vous)</span>}
                </p>
              </div>
              <span className="text-label-lg font-label-lg text-success-green">{entry.score}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type MasteryProfileDto } from "../../lib/api-client";
import { useSessionStore } from "../../stores/session.store";

interface RadarSubject {
  name: string;
  score: number;
}

const ENCOURAGING_QUOTES = [
  {
    text: "Le succès n'est pas final, l'échec n'est pas fatal : c'est le courage de continuer qui compte.",
    textEn: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    author: "Ton Coach d'Apprentissage",
    authorEn: "Your Learning Coach",
  },
  {
    text: "La persévérance n'est pas une longue course, c'est beaucoup de petites courses une après l'autre.",
    textEn: "Perseverance is not a long race; it is many short races one after the other.",
    author: "Walter Elliot",
    authorEn: "Walter Elliot",
  },
  {
    text: "Chaque expert était autrefois un débutant.",
    textEn: "Every expert was once a beginner.",
    author: "Helen Hayes",
    authorEn: "Helen Hayes",
  },
];

export function MasteryProfilePage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const [profiles, setProfiles] = useState<MasteryProfileDto[]>([]);
  const [loading, setLoading] = useState(true);
  const isLangFr = i18n.language.startsWith("fr");

  useEffect(() => {
    async function load() {
      const branchSlug = user?.branchPreferences[0];
      if (!branchSlug) {
        setLoading(false);
        return;
      }
      try {
        const { branches } = await api.branches();
        const branch = branches.find((b) => b.slug === branchSlug);
        if (branch) {
          const { profiles: data } = await api.mastery(branch.id);
          setProfiles(data);
        }
      } catch (err) {
        console.error("Failed to load mastery:", err);
      }
      setLoading(false);
    }
    load();
  }, [user]);

  const sortedProfiles = [...profiles].sort((a, b) => b.mastery_score - a.mastery_score);
  const weakZones = sortedProfiles.filter((p) => p.is_weak_zone);
  const topPerformers = sortedProfiles.filter((p) => !p.is_weak_zone).slice(0, 5);

  const radarSubjects: RadarSubject[] = sortedProfiles.slice(0, 5).map((p) => ({
    name: p.subjects?.name ?? "?",
    score: p.mastery_score,
  }));

  // Generate SVG radar chart points
  function radarPoints(subjects: RadarSubject[]): string {
    const cx = 100, cy = 100, r = 80;
    const n = subjects.length;
    if (n === 0) return "";
    return subjects
      .map((s, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const dist = (s.score / 100) * r;
        return `${cx + dist * Math.cos(angle)},${cy + dist * Math.sin(angle)}`;
      })
      .join(" ");
  }

  function radarLabelPositions(subjects: RadarSubject[]) {
    const cx = 100, cy = 100, r = 80;
    const n = subjects.length;
    return subjects.map((s, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const labelR = r + 20;
      return { x: cx + labelR * Math.cos(angle), y: cy + labelR * Math.sin(angle), name: s.name };
    });
  }

  const quote = ENCOURAGING_QUOTES[0]!;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-xl">
        <MaterialIcon name="hourglass_empty" className="text-excellence-blue animate-spin text-[32px]" />
      </div>
    );
  }

  return (
    <div className="max-w-[720px] mx-auto">
      {/* Mastery Header */}
      <section className="mb-lg">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-headline-lg-mobile font-headline-lg-mobile text-excellence-blue">
            {isLangFr ? "Votre Profil de Maîtrise" : "Your Mastery Profile"}
          </h2>
          <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-label-md font-label-md">
            {isLangFr ? "Diagnostic Prêt" : "Diagnostic Ready"}
          </span>
        </div>
        <p className="text-body-md text-on-surface-variant">
          {isLangFr
            ? "Voici votre progression sur le chemin de l'excellence."
            : "Here's where you stand on the road to excellence."}
        </p>
      </section>

      {/* Radar Chart Card */}
      {radarSubjects.length >= 3 && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm mb-lg">
          <div className="flex justify-between items-start mb-md">
            <div>
              <h3 className="text-headline-md font-headline-md text-excellence-blue">
                {isLangFr ? "Carte des Matières" : "Subject Map"}
              </h3>
              <p className="text-body-sm text-on-surface-variant">
                {isLangFr ? "Vue multidimensionnelle des compétences" : "Multi-dimensional competence view"}
              </p>
            </div>
            <MaterialIcon name="insights" className="text-on-surface-variant" />
          </div>
          <div className="relative w-full flex justify-center py-4">
            <svg className="w-full max-w-[280px] h-auto drop-shadow-sm" viewBox="0 0 200 200">
              {/* Pentagon grid lines */}
              {[1, 0.75, 0.5, 0.25].map((scale) => (
                <polygon
                  key={scale}
                  points={[0, 1, 2, 3, 4]
                    .map((i) => {
                      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                      return `${100 + 80 * scale * Math.cos(angle)},${100 + 80 * scale * Math.sin(angle)}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
              ))}
              {/* Data polygon */}
              <polygon
                points={radarPoints(radarSubjects)}
                fill="rgba(37, 39, 70, 0.15)"
                stroke="#252746"
                strokeWidth="2"
              />
              {/* Labels */}
              {radarLabelPositions(radarSubjects).map((pos, i) => (
                <text
                  key={i}
                  className="text-[10px] font-semibold"
                  fill="#252746"
                  textAnchor={pos.x < 90 ? "end" : pos.x > 110 ? "start" : "middle"}
                  x={pos.x}
                  y={pos.y}
                >
                  {pos.name}
                </text>
              ))}
            </svg>
          </div>
        </div>
      )}

      {/* Subject Mastery Bars */}
      {sortedProfiles.length > 0 && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm mb-lg">
          <h3 className="text-label-lg font-label-lg text-on-surface-variant mb-md uppercase tracking-wider">
            {isLangFr ? "Meilleures Performances" : "Top Performers"}
          </h3>
          <div className="space-y-4">
            {(topPerformers.length > 0 ? topPerformers : sortedProfiles).map((p) => {
              const isWeak = p.is_weak_zone;
              const scoreColor = p.mastery_score >= 70
                ? "text-success-green"
                : isWeak
                  ? "text-error-red"
                  : "text-on-surface-variant";
              return (
                <div key={p.subject_id}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-body-md font-semibold text-excellence-blue">
                      {p.subjects?.name ?? (isLangFr ? "Matière" : "Subject")}
                    </span>
                    <span className={`text-label-lg font-label-lg ${scoreColor}`}>
                      {p.mastery_score}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        isWeak ? "bg-error-red opacity-60" : "bg-excellence-blue"
                      }`}
                      style={{ width: `${p.mastery_score}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Critical Weak Zone */}
      {weakZones.length > 0 && (() => {
        const weak = weakZones[0]!;
        return (
          <div className="bg-error-container/20 border border-error/20 rounded-xl p-md flex flex-col justify-between mb-lg">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MaterialIcon name="warning" className="text-error text-xl" />
                <h3 className="text-label-lg font-label-lg text-error-red uppercase tracking-wider">
                  {isLangFr ? "Zone Faible Critique" : "Critical Weak Zone"}
                </h3>
              </div>
              <p className="text-headline-md font-headline-md text-primary mb-2 leading-tight">
                {weak.subjects?.name ?? (isLangFr ? "Sujet" : "Subject")}
              </p>
              <p className="text-body-sm text-on-surface-variant">
                {isLangFr
                  ? `Votre précision actuelle est de ${100 - weak.mastery_score}% en dessous de la cible.`
                  : `Your current accuracy is ${100 - weak.mastery_score}% below the target.`}
              </p>
            </div>
            <div className="mt-4 p-3 bg-white/50 rounded-lg border border-error-red/10 flex items-center justify-between">
              <span className="text-label-md font-label-md text-error-red">
                {isLangFr ? "Nécessite une attention immédiate" : "Needs Immediate Attention"}
              </span>
              <MaterialIcon name="priority_high" className="text-error-red animate-pulse" />
            </div>
          </div>
        );
      })()}

      {/* Study Plan CTA */}
      <div className="relative bg-excellence-blue text-on-primary rounded-2xl p-lg overflow-hidden mb-xl">
        <div className="relative z-10">
          <h3 className="text-headline-lg font-headline-lg mb-2">
            {isLangFr ? "Votre Chemin vers l'Excellence" : "Your Path to Excellence"}
          </h3>
          <p className="text-body-md opacity-90 mb-lg max-w-[80%]">
            {isLangFr
              ? "Nous avons calculé un itinéraire personnalisé ciblant vos zones faibles pour améliorer votre score."
              : "We've calculated a custom route focusing on your Weak Zones to boost your score."}
          </p>
          <button
            type="button"
            onClick={() => navigate("/app/tutor")}
            className="bg-secondary-container text-on-secondary-container font-bold px-lg py-md rounded-xl hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
          >
            {isLangFr ? "Voir Mon Plan d'Étude" : "View My Custom Study Plan"}
            <MaterialIcon name="trending_up" />
          </button>
        </div>
        <div className="absolute top-0 right-0 w-32 h-full opacity-10 flex flex-col justify-around items-end p-4 pointer-events-none">
          <MaterialIcon name="architecture" className="text-6xl" />
          <MaterialIcon name="calculate" className="text-6xl" />
        </div>
      </div>

      {/* Encouraging Quote */}
      <div className="text-center py-md px-margin-mobile bg-surface-container-low rounded-xl border-dashed border-2 border-outline-variant mb-xl">
        <p className="text-body-sm italic text-on-surface-variant">"{isLangFr ? quote.text : quote.textEn}"</p>
        <p className="text-label-md font-bold text-excellence-blue mt-2">— {isLangFr ? quote.author : quote.authorEn}</p>
      </div>

      {/* Back button */}
      <button
        type="button"
        onClick={() => navigate("/app")}
        className="w-full bg-excellence-blue text-white font-label-lg text-label-lg py-4 rounded-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-sm mb-xl"
      >
        {isLangFr ? "Retour au tableau de bord" : "Back to Dashboard"}
        <MaterialIcon name="arrow_forward" />
      </button>
    </div>
  );
}

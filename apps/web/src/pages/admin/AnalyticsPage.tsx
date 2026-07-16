import { useEffect, useState } from "react";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type AdminMetricsDto } from "../../lib/api-client";

const CARDS: { key: keyof AdminMetricsDto; icon: string; label: string }[] = [
  { key: "totalStudents", icon: "group", label: "Étudiants inscrits" },
  { key: "totalTeachers", icon: "school", label: "Enseignants" },
  { key: "publishedLessons", icon: "menu_book", label: "Leçons publiées" },
  { key: "publishedQcms", icon: "quiz", label: "QCMs publiés" },
  { key: "pendingReviews", icon: "fact_check", label: "En attente de révision" },
  { key: "activeSubscriptions", icon: "payments", label: "Abonnements actifs" },
];

/** No matching Stitch design — built from tokens (WEB-A01 statistiques). */
export function AnalyticsPage() {
  const [metrics, setMetrics] = useState<AdminMetricsDto | null>(null);

  useEffect(() => {
    api.adminMetrics().then(setMetrics);
  }, []);

  if (!metrics) return null;

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-excellence-blue mb-lg">Statistiques</h1>
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
        {CARDS.map((card) => (
          <div key={card.key} className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant flex flex-col gap-sm">
            <MaterialIcon name={card.icon} className="text-action-blue bg-surface-container p-2 rounded-lg w-fit" />
            <span className="font-label-lg text-label-lg text-text-secondary">{card.label}</span>
            <span className="font-display-lg text-display-lg text-excellence-blue">{metrics[card.key]}</span>
          </div>
        ))}
      </section>
      <p className="mt-lg font-body-sm text-body-sm text-text-secondary">
        MRR, DAU/WAU/MAU et les graphiques d'évolution nécessitent l'historique de facturation CinetPay (non connecté
        pour le moment) et un pipeline d'événements d'activité — non disponibles tant que ces intégrations ne sont
        pas en place.
      </p>
    </div>
  );
}

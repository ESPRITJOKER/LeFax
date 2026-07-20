import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type AdminMetricsDto } from "../../lib/api-client";

const CARDS: { key: keyof AdminMetricsDto; icon: string; labelKey: string }[] = [
  { key: "totalStudents", icon: "group", labelKey: "analytics.totalStudents" },
  { key: "totalTeachers", icon: "school", labelKey: "analytics.totalTeachers" },
  { key: "publishedLessons", icon: "menu_book", labelKey: "analytics.publishedLessons" },
  { key: "publishedQcms", icon: "quiz", labelKey: "analytics.publishedQcms" },
  { key: "pendingReviews", icon: "fact_check", labelKey: "analytics.pendingReviews" },
  { key: "activeSubscriptions", icon: "payments", labelKey: "analytics.activeSubscriptions" },
];

/** No matching Stitch design — built from tokens (WEB-A01 statistiques). */
export function AnalyticsPage() {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<AdminMetricsDto | null>(null);

  useEffect(() => {
    api.adminMetrics().then(setMetrics);
  }, []);

  if (!metrics) return null;

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-excellence-blue mb-lg">{t("analytics.title")}</h1>
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
        {CARDS.map((card) => (
          <div key={card.key} className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant flex flex-col gap-sm">
            <MaterialIcon name={card.icon} className="text-action-blue bg-surface-container p-2 rounded-lg w-fit" />
            <span className="font-label-lg text-label-lg text-text-secondary">{t(card.labelKey)}</span>
            <span className="font-display-lg text-display-lg text-excellence-blue">{metrics[card.key]}</span>
          </div>
        ))}
      </section>
      <p className="mt-lg font-body-sm text-body-sm text-text-secondary">
        {t("analytics.dataNote")}
      </p>
    </div>
  );
}

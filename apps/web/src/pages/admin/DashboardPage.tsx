import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../../components/ui/MaterialIcon";

const STATS = [
  { icon: "group", labelKey: "adminDashboard.dau" },
  { icon: "payments", labelKey: "adminDashboard.mrr" },
  { icon: "fact_check", labelKey: "adminDashboard.reviewQueue" },
  { icon: "library_books", labelKey: "adminDashboard.publishedContent" },
] as const;

/** Phase-0/1 scope (CDC §11) — real metrics land with WEB-A01 in Phase 6. */
export function AdminDashboardPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-xl">
      <h1 className="font-headline-lg text-headline-lg text-excellence-blue">{t("adminDashboard.title")}</h1>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
        {STATS.map((stat) => (
          <div
            key={stat.labelKey}
            className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant flex flex-col gap-sm"
          >
            <MaterialIcon name={stat.icon} className="text-action-blue bg-surface-container p-2 rounded-lg w-fit" />
            <span className="font-label-lg text-label-lg text-text-secondary">{t(stat.labelKey)}</span>
            <span className="font-display-lg text-display-lg text-excellence-blue">—</span>
          </div>
        ))}
      </section>
    </div>
  );
}

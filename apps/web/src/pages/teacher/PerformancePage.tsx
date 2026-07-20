import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type TeacherContentItemDto } from "../../lib/api-client";

/** No matching Stitch design — built from tokens (WEB-T01 performance du contenu). */
export function PerformancePage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<TeacherContentItemDto[]>([]);

  useEffect(() => {
    api.teacherContent().then((res) => setItems(res.items));
  }, []);

  const counts = {
    approved: items.filter((i) => i.status === "approved").length,
    in_review: items.filter((i) => i.status === "in_review").length,
    draft: items.filter((i) => i.status === "draft").length,
    rejected: items.filter((i) => i.status === "rejected").length,
  };

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-excellence-blue mb-lg">{t("performance.title")}</h1>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-gutter mb-lg">
        <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant flex flex-col gap-sm">
          <MaterialIcon name="task_alt" className="text-success-green bg-surface-container p-2 rounded-lg w-fit" />
          <span className="font-label-lg text-label-lg text-text-secondary">{t("performance.published")}</span>
          <span className="font-display-lg text-display-lg text-excellence-blue">{counts.approved}</span>
        </div>
        <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant flex flex-col gap-sm">
          <MaterialIcon name="hourglass_top" className="text-action-blue bg-surface-container p-2 rounded-lg w-fit" />
          <span className="font-label-lg text-label-lg text-text-secondary">{t("performance.inReview")}</span>
          <span className="font-display-lg text-display-lg text-excellence-blue">{counts.in_review}</span>
        </div>
        <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant flex flex-col gap-sm">
          <MaterialIcon name="edit_note" className="text-text-secondary bg-surface-container p-2 rounded-lg w-fit" />
          <span className="font-label-lg text-label-lg text-text-secondary">{t("performance.drafts")}</span>
          <span className="font-display-lg text-display-lg text-excellence-blue">{counts.draft}</span>
        </div>
        <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant flex flex-col gap-sm">
          <MaterialIcon name="cancel" className="text-error-red bg-surface-container p-2 rounded-lg w-fit" />
          <span className="font-label-lg text-label-lg text-text-secondary">{t("performance.rejected")}</span>
          <span className="font-display-lg text-display-lg text-excellence-blue">{counts.rejected}</span>
        </div>
      </section>
      <p className="font-body-sm text-body-sm text-text-secondary">
        {t("performance.dataNote")}
      </p>
    </div>
  );
}

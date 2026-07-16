import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type TeacherContentItemDto } from "../../lib/api-client";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-surface-container text-on-surface-variant",
  in_review: "bg-secondary-container text-on-secondary-container",
  approved: "bg-success-green/10 text-success-green",
  rejected: "bg-error-red/10 text-error-red",
};

interface ContentListPanelProps {
  items: TeacherContentItemDto[];
  titleOf: (item: TeacherContentItemDto) => string;
  onSubmitted: () => void;
}

/** Shared draft/status list + submit-for-review action (WEB-T05), reused across teacher content type pages. */
export function ContentListPanel({ items, titleOf, onSubmitted }: ContentListPanelProps) {
  const { t } = useTranslation();
  const statusLabels: Record<string, string> = {
    draft: t("teacherContent.status.draft"),
    in_review: t("teacherContent.status.inReview"),
    approved: t("teacherContent.status.approved"),
    rejected: t("teacherContent.status.rejected"),
  };

  async function submitForReview(item: TeacherContentItemDto) {
    await api.submitForReview(item.type, item.id);
    onSubmitted();
  }

  if (items.length === 0) {
    return <p className="font-body-md text-body-md text-text-secondary text-center py-lg">{t("teacherContent.empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-sm">
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between p-md bg-surface-container-lowest border border-outline-variant rounded-xl">
          <div className="flex-1 min-w-0">
            <p className="font-label-lg text-label-lg text-primary truncate">{titleOf(item)}</p>
            {item.status === "rejected" && item.feedback && (
              <p className="font-body-sm text-body-sm text-error-red mt-1">{item.feedback}</p>
            )}
          </div>
          <div className="flex items-center gap-sm shrink-0 ml-sm">
            <span className={`px-2 py-1 rounded-full text-label-md font-label-md ${STATUS_STYLES[item.status]}`}>
              {statusLabels[item.status]}
            </span>
            {(item.status === "draft" || item.status === "rejected") && (
              <button
                type="button"
                onClick={() => submitForReview(item)}
                className="text-label-md font-label-md text-action-blue flex items-center gap-1"
              >
                <MaterialIcon name="send" className="text-[14px]" />
                {t("teacherContent.submit")}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

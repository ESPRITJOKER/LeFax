import { Icon } from "../lib/icons";
import { useI18n } from "../lib/i18n";
import { isSupabaseConfigured } from "../lib/supabaseClient";

/**
 * "Nothing here yet" and "the request failed" are different facts and must read
 * differently — conflating them was one of the audited defects
 * (TeacherPerformance rendered the same i18n key on both branches of a ternary,
 * so a broken request looked exactly like an empty result).
 *
 * `error` wins over `empty`, and a missing backend is reported as itself rather
 * than as a failure, so a developer without `.env.local` sees the real reason.
 */
export function StateNotice({
  error,
  emptyLabel,
  errorLabel,
  onRetry,
}: {
  error?: string | null;
  emptyLabel: string;
  errorLabel: string;
  onRetry?: () => void;
}) {
  const { t } = useI18n();

  if (!isSupabaseConfigured) {
    return <div className="text-center py-10 text-muted text-sm">{t("backend_banner")}</div>;
  }

  if (error) {
    return (
      <div role="alert" className="rounded-2xl border border-danger-600/30 bg-danger-600/5 px-4 py-5 text-center">
        <div className="flex items-center justify-center gap-2 text-danger-600 mb-1.5">
          <Icon name="close" size={15} />
          <span className="text-[13px] font-bold">{errorLabel}</span>
        </div>
        <div className="text-[11.5px] text-muted break-words mb-2">{error}</div>
        {onRetry && (
          <button onClick={onRetry} className="border border-border bg-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold text-ink-900">
            {t("common_retry")}
          </button>
        )}
      </div>
    );
  }

  return <div className="text-center py-10 text-muted text-sm">{emptyLabel}</div>;
}

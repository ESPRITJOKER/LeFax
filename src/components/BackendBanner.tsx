import { isSupabaseConfigured } from "../lib/supabaseClient";
import { useI18n } from "../lib/i18n";
import { Icon } from "../lib/icons";

/**
 * Per the scaffold brief: when there is no live Supabase project wired up yet,
 * show a small non-blocking banner instead of crashing on network calls that
 * have nowhere valid to go.
 */
export function BackendBanner() {
  const { t } = useI18n();
  if (isSupabaseConfigured) return null;
  return (
    <div className="flex items-center gap-2 bg-ochre-100 text-ochre-700 text-xs font-semibold px-4 py-2">
      <Icon name="shield" size={14} />
      <span>{t("backend_banner")}</span>
    </div>
  );
}

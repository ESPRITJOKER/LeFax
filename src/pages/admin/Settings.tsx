import { useEffect, useState } from "react";
import { Button, Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { SettingsRow } from "../../lib/database.types";

export default function AdminSettings() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<SettingsRow[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase.from("settings").select("*").order("key");
      setSettings(data ?? []);
      setDraft(Object.fromEntries((data ?? []).map((s) => [s.key, JSON.stringify(s.value)])));
      setLoading(false);
    })();
  }, []);

  async function save(key: string) {
    setMessage(null);
    try {
      const value = JSON.parse(draft[key]);
      await supabase.from("settings").update({ value, updated_at: new Date().toISOString() }).eq("key", key);
      setMessage(t("admin_save"));
    } catch {
      setMessage(t("common_error"));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {loading ? (
        <Spinner />
      ) : settings.length === 0 ? (
        <EmptyState label={isSupabaseConfigured ? t("common_error") : t("backend_banner")} />
      ) : (
        settings.map((s) => (
          <div key={s.key} className="bg-white border border-border rounded-2xl p-4.5 p-[18px] flex items-center gap-3.5 flex-wrap">
            <div className="flex-1 min-w-[160px] text-[13px] font-bold text-ink-900">{s.key}</div>
            <input
              value={draft[s.key] ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))}
              className="px-3 py-2 rounded-lg border-[1.5px] border-border text-[13px] flex-1 min-w-[120px]"
            />
            <Button onClick={() => save(s.key)}>{t("admin_save")}</Button>
          </div>
        ))
      )}
      {message && <div className="text-xs font-semibold text-success-600">{message}</div>}
    </div>
  );
}

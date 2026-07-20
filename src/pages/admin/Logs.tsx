import { useEffect, useState } from "react";
import { Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { AdminLogRow } from "../../lib/database.types";

export default function AdminLogs() {
  const { t } = useI18n();
  const [logs, setLogs] = useState<AdminLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase.from("admin_logs").select("*").order("created_at", { ascending: false }).limit(200);
      setLogs(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="bg-white border border-border rounded-2xl overflow-x-auto">
      {loading ? (
        <Spinner />
      ) : logs.length === 0 ? (
        <EmptyState label={isSupabaseConfigured ? t("common_error") : t("backend_banner")} />
      ) : (
        <table className="w-full border-collapse min-w-[640px]">
          <thead>
            <tr className="text-left border-b border-border">
              <th className="px-4 py-3 text-[11.5px] text-muted font-bold">Action</th>
              <th className="px-4 py-3 text-[11.5px] text-muted font-bold">Table</th>
              <th className="px-4 py-3 text-[11.5px] text-muted font-bold">Date</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-ink-50">
                <td className="px-4 py-3 text-[13px] font-semibold text-ink-900">{l.action}</td>
                <td className="px-4 py-3 text-xs text-ink-800">{l.target_table}</td>
                <td className="px-4 py-3 text-xs text-muted">{new Date(l.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

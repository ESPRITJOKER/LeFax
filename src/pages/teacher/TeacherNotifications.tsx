import { useCallback, useEffect, useState } from "react";
import { Icon } from "../../lib/icons";
import { Spinner } from "../../components/ui";
import { StateNotice } from "../../components/StateNotice";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { NotificationRow } from "../../lib/database.types";

/**
 * Teacher notifications: approval verdicts, reviewer feedback, subject
 * assignment changes and platform announcements.
 *
 * Reuses the existing `notifications` table and its "strictly own rows" policy —
 * the workflow types were added to its CHECK constraint in 0018, and the rows
 * are written server-side by the `admin` / `teacher` / `ai-content` functions so
 * a teacher can never fabricate one.
 */
const TYPE_ICON: Record<NotificationRow["type"], { emoji: string; bg: string }> = {
  daily_reminder: { emoji: "⏰", bg: "#e8f4ff" },
  mock_reminder: { emoji: "📝", bg: "#e8f4ff" },
  reward: { emoji: "🎁", bg: "#f3e8ff" },
  ranking_update: { emoji: "🏆", bg: "#fff4e0" },
  system: { emoji: "✅", bg: "#dcf5e3" },
  content_submitted: { emoji: "📤", bg: "#e8f4ff" },
  content_approved: { emoji: "✅", bg: "#dcf5e3" },
  content_rejected: { emoji: "✏️", bg: "#fff4e0" },
  subject_assigned: { emoji: "🎓", bg: "#f3e8ff" },
};

export default function TeacherNotifications() {
  const { t, lang } = useI18n();
  const { profile } = useAuth();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !profile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: qError } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setRows(data ?? []);
    setError(qError?.message ?? null);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function markAllRead() {
    if (!profile || busy) return;
    setBusy(true);
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", profile.id).eq("is_read", false);
    await load();
    setBusy(false);
  }

  if (loading) return <Spinner />;
  if (error || rows.length === 0) {
    return <StateNotice error={error} emptyLabel={t("tn_empty")} errorLabel={t("common_error")} onRetry={load} />;
  }

  const unread = rows.filter((r) => !r.is_read).length;

  return (
    <div className="max-w-[720px] flex flex-col gap-2.5">
      {unread > 0 && (
        <div className="flex items-center gap-3 mb-1">
          <span className="text-[12px] text-muted flex-1">
            {unread} {lang === "fr" ? "non lues" : "unread"}
          </span>
          <button onClick={markAllRead} disabled={busy} className="border border-border bg-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold text-ink-900 disabled:opacity-60">
            {t("tn_markAllRead")}
          </button>
        </div>
      )}

      {rows.map((n) => {
        const style = TYPE_ICON[n.type] ?? TYPE_ICON.system;
        return (
          <div key={n.id} className={`bg-white border rounded-2xl px-4 py-3.5 flex gap-3 ${n.is_read ? "border-border" : "border-brand-600/40"}`}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-none text-[16px]" style={{ background: style.bg }}>
              {style.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-ink-900">{lang === "fr" ? n.title_fr : n.title_en || n.title_fr}</div>
              {(lang === "fr" ? n.body_fr : n.body_en) && (
                <div className="text-[12px] text-ink-800 leading-relaxed mt-0.5">{lang === "fr" ? n.body_fr : n.body_en}</div>
              )}
              <div className="text-[11px] text-muted mt-1">
                {new Date(n.created_at).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")}
              </div>
            </div>
            {!n.is_read && <Icon name="bell" size={14} className="text-brand-600 flex-none" />}
          </div>
        );
      })}
    </div>
  );
}

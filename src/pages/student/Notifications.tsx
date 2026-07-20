import { useEffect, useState } from "react";
import { PhoneFrame } from "../../components/PhoneFrame";
import { ScreenHeader } from "../../components/ScreenHeader";
import { Icon } from "../../lib/icons";
import { Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { NotificationRow } from "../../lib/database.types";

export default function Notifications() {
  const { t, lang } = useI18n();
  const { profile } = useAuth();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!isSupabaseConfigured || !profile) {
      setLoading(false);
      return;
    }
    const { data } = await supabase.from("notifications").select("*").eq("user_id", profile.id).order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function markAllRead() {
    if (!profile) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", profile.id).eq("is_read", false);
    await load();
  }

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col overflow-y-auto">
        <ScreenHeader title={t("notif_title")} />
        <div className="px-[22px] pt-3 flex justify-end">
          <button onClick={markAllRead} className="text-xs font-semibold text-ink-700">
            {t("notif_markAllRead")}
          </button>
        </div>
        <div className="px-[22px] pt-2 pb-6 flex flex-col gap-2.5">
          {loading ? (
            <Spinner />
          ) : items.length === 0 ? (
            <EmptyState label={isSupabaseConfigured ? t("notif_empty") : t("backend_banner")} />
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 p-3.5 rounded-2xl border ${n.is_read ? "border-border bg-white" : "border-ink-300 bg-ink-50"}`}
              >
                <div className="w-9 h-9 flex-none rounded-[10px] bg-ink-100 flex items-center justify-center text-ink-700">
                  <Icon name="bell" size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-ink-900">{lang === "fr" ? n.title_fr : n.title_en}</div>
                  <div className="text-[12px] text-muted mt-0.5">{lang === "fr" ? n.body_fr : n.body_en}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}

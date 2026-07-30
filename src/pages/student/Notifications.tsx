import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { TopBar } from "../../components/TopBar";
import { Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { NotificationRow } from "../../lib/database.types";

const TYPE_STYLE: Record<NotificationRow["type"], { emoji: string; bg: string }> = {
  daily_reminder: { emoji: "⏰", bg: "#e8f4ff" },
  mock_reminder: { emoji: "📝", bg: "#e8f4ff" },
  reward: { emoji: "🎁", bg: "#f3e8ff" },
  ranking_update: { emoji: "🏆", bg: "#fff4e0" },
  system: { emoji: "✅", bg: "#dcf5e3" },
};

function relativeTime(iso: string, lang: "fr" | "en"): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${Math.max(1, min)}${lang === "fr" ? "min" : "m"}`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}${lang === "fr" ? "j" : "d"}`;
}

export default function Notifications() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
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
      <div className="flex-1 min-h-0 flex flex-col bg-white">
        <TopBar variant="title" title={lang === "fr" ? "Notifications" : "Notifications"} onBack={() => navigate(-1)} />

        <div className="px-5 pt-3 flex justify-end">
          <button onClick={markAllRead} className="text-xs font-semibold text-brand-600">
            {t("notif_markAllRead")}
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-5 pt-1 pb-6">
          {loading ? (
            <Spinner />
          ) : items.length === 0 ? (
            <EmptyState label={isSupabaseConfigured ? t("notif_empty") : t("backend_banner")} />
          ) : (
            items.map((n) => {
              const st = TYPE_STYLE[n.type] ?? { emoji: "🔔", bg: "#e8f4ff" };
              return (
                <div key={n.id} className="flex gap-3 py-3.5 border-b border-[#f4f6f9]">
                  <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center flex-shrink-0 text-[17px]" style={{ background: st.bg }}>
                    {st.emoji}
                  </div>
                  <div className="flex-1">
                    <div className={`text-[13px] text-ink-900 leading-[1.4] ${n.is_read ? "font-normal" : "font-semibold"}`}>
                      {lang === "fr" ? n.title_fr : n.title_en}
                    </div>
                    <div className="text-[12px] text-muted mt-0.5">{lang === "fr" ? n.body_fr : n.body_en}</div>
                    <div className="text-[11px] text-[#94a3b8] mt-1">{relativeTime(n.created_at, lang)}</div>
                  </div>
                  {!n.is_read && <div className="w-2 h-2 rounded-full bg-brand-500 mt-1 flex-shrink-0" />}
                </div>
              );
            })
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}

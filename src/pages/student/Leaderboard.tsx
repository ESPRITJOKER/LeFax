import { useEffect, useState } from "react";
import { PhoneFrame } from "../../components/PhoneFrame";
import { BottomTabs } from "../../components/BottomTabs";
import { Pill, Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { RankingRow, RankingScope } from "../../lib/database.types";

const TABS: { id: RankingScope; labelKey: "lead_regional" | "lead_national" | "lead_weekly" }[] = [
  { id: "regional", labelKey: "lead_regional" },
  { id: "national", labelKey: "lead_national" },
  { id: "weekly", labelKey: "lead_weekly" },
];

export default function Leaderboard() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const [scope, setScope] = useState<RankingScope>("regional");
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      let query = supabase.from("rankings").select("*").eq("scope", scope).order("score", { ascending: false }).limit(50);
      if (scope === "regional" && profile?.region) query = query.eq("region", profile.region);
      const { data } = await query;
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [scope, profile]);

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="px-[22px] pt-4 font-serif font-bold text-xl text-ink-950">{t("lead_title")}</div>
        <div className="flex gap-1.5 px-[22px] pt-3.5 pb-1">
          {TABS.map((tab) => (
            <Pill key={tab.id} active={scope === tab.id} onClick={() => setScope(tab.id)}>
              {t(tab.labelKey)}
            </Pill>
          ))}
        </div>
        <div className="px-[22px] pt-2.5 pb-6 flex flex-col gap-2">
          {loading ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <EmptyState label={isSupabaseConfigured ? t("common_error") : t("backend_banner")} />
          ) : (
            rows.map((row, i) => {
              const isMe = row.user_id === profile?.id;
              return (
                <div
                  key={row.id}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-[13px] border-[1.5px] ${
                    isMe ? "border-ink-300 bg-ink-50" : "border-border bg-white"
                  }`}
                >
                  <div className={`w-[22px] text-[13px] font-extrabold ${i < 3 ? "text-ochre-600" : "text-muted"}`}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-ink-900">
                      {row.display_name}
                      {isMe ? ` (${t("lead_you")})` : ""}
                    </div>
                    <div className="text-[11px] text-muted">{row.town}</div>
                  </div>
                  <div className="text-[13px] font-extrabold text-ink-800">{row.score}</div>
                </div>
              );
            })
          )}
        </div>
        <BottomTabs />
      </div>
    </PhoneFrame>
  );
}

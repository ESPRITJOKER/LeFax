import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { BottomTabs } from "../../components/BottomTabs";
import { TopBar } from "../../components/TopBar";
import { Drawer } from "../../components/Drawer";
import { Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { RankingRow, RankingScope } from "../../lib/database.types";

const PODIUM = [
  { idx: 1, size: 52, bar: 56, bg: "#e2e8f0", avatar: "#cbd5e1", num: "2", numColor: "#94a3b8" },
  { idx: 0, size: 64, bar: 78, bg: "#f5b400", avatar: "#f5b400", num: "1", numColor: "#7a5200" },
  { idx: 2, size: 52, bar: 42, bg: "#eddcc4", avatar: "#d99a5b", num: "3", numColor: "#a9784a" },
];

export default function Leaderboard() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [scope, setScope] = useState<RankingScope>("national");
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(false);

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

  const initial = (profile?.first_name?.[0] ?? "?").toUpperCase();
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <PhoneFrame>
      <div className="flex-1 min-h-0 flex flex-col">
        <TopBar
          variant="menu"
          coins={profile?.faxcoins ?? 0}
          initial={initial}
          onMenu={() => setDrawer(true)}
          onCoins={() => navigate("/shop")}
          onAvatar={() => navigate("/profile")}
        />

        <div className="flex-1 min-h-0 overflow-auto px-5 pt-4 pb-[90px]">
          <h2 className="font-serif font-bold text-[18px] text-ink-900 mb-3">{lang === "fr" ? "Classement général" : "Overall ranking"}</h2>

          <div className="flex gap-2 mb-5">
            {(["regional", "national", "weekly"] as RankingScope[]).map((sc) => (
              <button
                key={sc}
                onClick={() => setScope(sc)}
                className="px-3.5 py-1.5 rounded-pill text-[12px] font-semibold border"
                style={{
                  background: scope === sc ? "#2f9bf0" : "#fff",
                  color: scope === sc ? "#fff" : "#334155",
                  borderColor: scope === sc ? "#2f9bf0" : "#e2e8f0",
                }}
              >
                {t(`lead_${sc}` as "lead_regional")}
              </button>
            ))}
          </div>

          {loading ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <EmptyState label={isSupabaseConfigured ? (lang === "fr" ? "Classement bientôt disponible" : "Ranking coming soon") : t("backend_banner")} />
          ) : (
            <>
              <div className="flex justify-center items-end gap-3 mb-6">
                {PODIUM.map((p) => {
                  const row = top3[p.idx];
                  if (!row) return <div key={p.num} className="w-[64px]" />;
                  return (
                    <div key={p.num} className="text-center">
                      <div
                        className="rounded-full text-white font-serif font-bold flex items-center justify-center mx-auto mb-1.5 overflow-hidden"
                        style={{ width: p.size, height: p.size, background: p.avatar, fontSize: p.idx === 0 ? 22 : 18 }}
                      >
                        {row.avatar_url ? <img src={row.avatar_url} alt="" className="w-full h-full object-cover" /> : row.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-[11px] font-semibold text-ink-900 truncate max-w-[70px]">{row.display_name}</div>
                      <div
                        className="rounded-t-lg mt-1.5 mx-auto flex items-center justify-center font-serif font-extrabold"
                        style={{ width: p.idx === 0 ? 70 : 60, height: p.bar, background: p.bg, color: p.numColor, fontSize: p.idx === 0 ? 20 : 16 }}
                      >
                        {p.num}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-card rounded-[14px] px-4 py-1.5 shadow-[0_2px_10px_rgba(20,30,60,0.05)]">
                {rest.map((row, i) => {
                  const isMe = row.user_id === profile?.id;
                  return (
                    <div key={row.id} className="flex items-center gap-3 py-2.5 border-b border-[#f4f6f9] last:border-0">
                      <div className="w-5 text-center text-[12.5px] font-bold text-muted">{i + 4}</div>
                      <div className="w-[34px] h-[34px] rounded-full bg-brand-500 text-white font-serif font-bold text-[13px] flex items-center justify-center overflow-hidden">
                        {row.avatar_url ? <img src={row.avatar_url} alt="" className="w-full h-full object-cover" /> : row.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 text-[13px] font-semibold text-ink-900 truncate">
                        {row.display_name}
                        {isMe ? ` (${t("lead_you")})` : ""}
                      </div>
                      <div className="font-serif font-bold text-[13px] text-ink-900">{row.score}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <BottomTabs active="perfs" />
        <Drawer open={drawer} onClose={() => setDrawer(false)} />
      </div>
    </PhoneFrame>
  );
}

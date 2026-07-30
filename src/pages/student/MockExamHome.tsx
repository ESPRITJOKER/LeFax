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
import type { MockExamRow, RankingRow } from "../../lib/database.types";

const MONTHS_FR = ["JANV.", "FÉVR.", "MARS", "AVR.", "MAI", "JUIN", "JUIL.", "AOÛT", "SEPT.", "OCT.", "NOV.", "DÉC."];
const AVATAR_COLORS = ["#f5b400", "#94a3b8", "#d99a5b", "#29b6f6"];

function formatCountdown(ms: number) {
  const c = Math.max(0, ms);
  const d = Math.floor(c / 86400000);
  const h = Math.floor((c % 86400000) / 3600000);
  const m = Math.floor((c % 3600000) / 60000);
  const s = Math.floor((c % 60000) / 1000);
  return `${d}j ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function MockExamHome() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [mock, setMock] = useState<MockExamRow | null>(null);
  const [rankings, setRankings] = useState<RankingRow[]>([]);
  const [tab, setTab] = useState<"epreuves" | "classement">("epreuves");
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase.from("mock_exams").select("*").in("status", ["scheduled", "open"]).order("opens_at").limit(1);
      setMock(data?.[0] ?? null);
      const { data: rankRows } = await supabase.from("rankings").select("*").eq("scope", "national").order("score", { ascending: false }).limit(20);
      setRankings(rankRows ?? []);
      setLoading(false);
    })();
  }, []);

  const initial = (profile?.first_name?.[0] ?? "?").toUpperCase();
  const opensAt = mock ? new Date(mock.opens_at) : null;
  const closesAt = mock ? new Date(mock.closes_at) : null;
  const isOpen = mock ? now >= (opensAt?.getTime() ?? 0) && mock.status !== "closed" : false;

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

        <div className="flex-1 min-h-0 overflow-auto pb-[90px]">
          {loading ? (
            <Spinner />
          ) : !mock ? (
            <EmptyState label={isSupabaseConfigured ? t("mock_none") : t("backend_banner")} />
          ) : (
            <>
              <div className="bg-[#eef3f9] px-5 pt-[18px]">
                <div className="flex gap-3.5 items-start mb-4">
                  <div className="text-center flex-shrink-0">
                    <div className="text-[20px] font-bold text-muted leading-none">{opensAt?.getDate()}</div>
                    <div className="text-[10.5px] text-danger-600 font-bold tracking-[0.5px]">{opensAt ? MONTHS_FR[opensAt.getMonth()] : ""}</div>
                    <div className="text-[10px] mt-1 flex items-center gap-[3px] justify-center" style={{ color: isOpen ? "#22c55e" : "#94a3b8" }}>
                      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: isOpen ? "#22c55e" : "#94a3b8" }} />
                      {isOpen ? (lang === "fr" ? "En cours" : "Open") : lang === "fr" ? "Programmé" : "Scheduled"}
                    </div>
                  </div>
                  <div>
                    <div className="font-serif font-bold text-[16px] text-ink-900 mb-1.5">{lang === "fr" ? mock.title_fr : mock.title_en}</div>
                    <div className="text-[12.5px] text-ink-800">
                      <b>{lang === "fr" ? "Du" : "From"}:</b> {opensAt?.toLocaleString(lang === "fr" ? "fr-FR" : "en-US", { dateStyle: "medium", timeStyle: "short" })}
                    </div>
                    <div className="text-[12.5px] text-ink-800">
                      <b>{lang === "fr" ? "Au" : "To"}:</b> {closesAt?.toLocaleString(lang === "fr" ? "fr-FR" : "en-US", { dateStyle: "medium", timeStyle: "short" })}
                    </div>
                  </div>
                </div>
                <div className="flex gap-6 border-b border-[#dde4ec]">
                  {(["epreuves", "classement"] as const).map((tk) => (
                    <button
                      key={tk}
                      onClick={() => setTab(tk)}
                      className="pb-2.5 font-serif font-semibold text-[14.5px] border-b-2"
                      style={{
                        color: tab === tk ? "#29b6f6" : "#94a3b8",
                        borderColor: tab === tk ? "#29b6f6" : "transparent",
                      }}
                    >
                      {tk === "epreuves" ? (lang === "fr" ? "Epreuves" : "Papers") : lang === "fr" ? "Classement" : "Ranking"}
                    </button>
                  ))}
                </div>
              </div>

              {tab === "epreuves" && (
                <div className="px-5 py-4">
                  <div className="bg-brand-800 rounded-2xl p-5 text-white text-center mb-4">
                    <div className="text-[11.5px] opacity-75 font-semibold mb-1.5">{isOpen ? t("mock_title") : t("mock_opensIn")}</div>
                    <div className="text-[26px] font-extrabold tabular-nums">
                      {isOpen ? (lang === "fr" ? "Ouvert" : "Open") : formatCountdown((opensAt?.getTime() ?? 0) - now)}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5 mb-4">
                    <StatBox value={`${mock.duration_minutes}min`} label={t("mock_duration")} />
                    <StatBox value={String(mock.question_count)} label={t("mock_questions")} />
                    <StatBox value={`${mock.passing_score}/100`} label={t("mock_passing")} />
                  </div>
                  <div className="bg-card border border-border rounded-xl p-4 mb-4">
                    <div className="text-xs font-bold text-ink-900 mb-2">{t("mock_instructions")}</div>
                    <ul className="list-disc pl-[18px] flex flex-col gap-1.5">
                      {(lang === "fr" ? mock.instructions_fr : mock.instructions_en).map((mi, i) => (
                        <li key={i} className="text-xs text-ink-800 leading-normal">
                          {mi}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    disabled={!isOpen || !mock.quiz_id}
                    onClick={() => mock.quiz_id && navigate(`/quiz/${mock.quiz_id}`)}
                    className="w-full bg-brand-500 text-white rounded-[10px] py-[15px] font-serif font-bold text-[14.5px] disabled:opacity-40"
                  >
                    {t("mock_start")}
                  </button>
                </div>
              )}

              {tab === "classement" && (
                <div className="px-5 py-4">
                  {rankings.length === 0 ? (
                    <EmptyState label={lang === "fr" ? "Classement bientôt disponible" : "Ranking coming soon"} />
                  ) : (
                    rankings.map((r, i) => {
                      const isMe = r.user_id === profile?.id;
                      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1);
                      return (
                        <div
                          key={r.id}
                          onClick={isMe ? () => navigate(`/mock-exam/${mock.id}/result`) : undefined}
                          className={`flex items-center gap-3 py-2.5 px-1 ${isMe ? "bg-ink-50 rounded-lg cursor-pointer" : ""}`}
                        >
                          <div className="w-[22px] text-center text-[13px] font-bold text-muted">{medal}</div>
                          <div
                            className="w-9 h-9 rounded-full text-white font-serif font-bold text-[14px] flex items-center justify-center overflow-hidden"
                            style={{ background: AVATAR_COLORS[Math.min(i, AVATAR_COLORS.length - 1)] }}
                          >
                            {r.avatar_url ? <img src={r.avatar_url} alt="" className="w-full h-full object-cover" /> : r.display_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 font-serif font-semibold text-[13.5px] text-ink-900 truncate">
                            {r.display_name}
                            {isMe ? ` (${t("lead_you")})` : ""}
                          </div>
                          <div className="font-serif font-bold text-[14px] text-ink-900">{r.score}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <BottomTabs active="evaluations" />
        <Drawer open={drawer} onClose={() => setDrawer(false)} />
      </div>
    </PhoneFrame>
  );
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="p-3 bg-card border border-border rounded-xl text-center">
      <div className="text-[15px] font-extrabold text-ink-900">{value}</div>
      <div className="text-[10.5px] text-muted mt-0.5">{label}</div>
    </div>
  );
}

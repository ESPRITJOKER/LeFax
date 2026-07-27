import { useEffect, useState } from "react";
import { PhoneFrame } from "../../components/PhoneFrame";
import { BottomTabs } from "../../components/BottomTabs";
import { CoinsBadge } from "../../components/CoinsBadge";
import { PodiumIcon } from "../../components/PodiumIcon";
import { Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { RankingRow, RankingScope, MockExamRow } from "../../lib/database.types";

const AVATAR_COLORS = ["#B8880A", "#9AA3B2", "#CD7F32", "var(--color-accent)"];

type TabId = RankingScope | "epreuves";

export default function Leaderboard() {
  const { t, lang } = useI18n();
  const { profile } = useAuth();
  const [tab, setTab] = useState<TabId>("regional");
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [mockExam, setMockExam] = useState<MockExamRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      if (tab === "epreuves") {
        // Soonest upcoming/open exam first — not the furthest-future or a
        // past closed one, which descending order could otherwise surface.
        const { data } = await supabase
          .from("mock_exams")
          .select("*")
          .in("status", ["scheduled", "open"])
          .order("opens_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        setMockExam(data ?? null);
        setRows([]);
      } else {
        let query = supabase.from("rankings").select("*").eq("scope", tab).order("score", { ascending: false }).limit(50);
        if (tab === "regional" && profile?.region) query = query.eq("region", profile.region);
        const { data } = await query;
        setRows(data ?? []);
        setMockExam(null);
      }
      setLoading(false);
    })();
  }, [tab, profile]);

  const examDate = mockExam ? new Date(mockExam.opens_at) : null;
  const dayNum = examDate ? examDate.getDate() : "";
  const monthNames = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
  const monthAbbr = examDate ? monthNames[examDate.getMonth()] : "";

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex flex-col gap-1 w-5">
            <span className="block h-0.5 bg-brand-800 rounded-sm"></span>
            <span className="block h-0.5 bg-brand-800 rounded-sm"></span>
            <span className="block h-0.5 bg-brand-800 rounded-sm"></span>
          </div>
          <CoinsBadge balance={profile?.faxcoins ?? 0} />
        </div>

        {mockExam && (
          <div className="mx-4 mb-3 bg-card border border-border rounded-[14px] p-3.5 flex gap-3">
            <div className="text-center w-11 flex-none">
              <div className="text-[19px] font-extrabold text-muted leading-none">{dayNum}</div>
              <div className="text-[10px] font-extrabold text-[#E0623F] uppercase">{monthAbbr}</div>
            </div>
            <div className="min-w-0">
              <h4 className="text-[13.5px] font-bold text-text mb-1 truncate">
                {lang === "fr" ? mockExam.title_fr : mockExam.title_en}
              </h4>
              <p className="text-[10.5px] text-muted">
                Du: {new Date(mockExam.opens_at).toLocaleDateString("fr-FR")}, à {new Date(mockExam.opens_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-[10.5px] text-muted">
                Au: {new Date(mockExam.closes_at).toLocaleDateString("fr-FR")}, à {new Date(mockExam.closes_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-6 px-4 border-b border-border mb-1.5">
          <button
            onClick={() => setTab("epreuves")}
            className={`pb-2.5 text-[13px] font-bold border-b-2 transition-colors ${
              tab === "epreuves" ? "text-accent border-accent" : "text-muted border-transparent"
            }`}
          >
            Epreuves
          </button>
          {(["regional", "national", "weekly"] as RankingScope[]).map((scope) => (
            <button
              key={scope}
              onClick={() => setTab(scope)}
              className={`pb-2.5 text-[13px] font-bold border-b-2 transition-colors ${
                tab === scope ? "text-accent border-accent" : "text-muted border-transparent"
              }`}
            >
              {t(`lead_${scope}` as "lead_regional")}
            </button>
          ))}
        </div>

        <div className="flex-1 pb-6">
          {loading ? (
            <Spinner />
          ) : tab === "epreuves" ? (
            !mockExam ? (
              <EmptyState label={isSupabaseConfigured ? t("mock_none") : t("backend_banner")} />
            ) : null
          ) : rows.length === 0 ? (
            <EmptyState label={isSupabaseConfigured ? t("common_error") : t("backend_banner")} />
          ) : (
            rows.map((row, i) => {
              const isMe = row.user_id === profile?.id;
              const initials = row.display_name.charAt(0).toUpperCase();
              const avatarColor = AVATAR_COLORS[Math.min(i, AVATAR_COLORS.length - 1)];
              return (
                <div
                  key={row.id}
                  className={`flex items-center gap-3 px-4 py-[11px] ${
                    isMe ? "bg-ink-50 border-b border-ink-100" : "border-b border-border"
                  }`}
                >
                  <div className="w-[22px] text-center flex-none">
                    {i < 3 ? (
                      <PodiumIcon rank={(i + 1) as 1 | 2 | 3} />
                    ) : (
                      <span className="text-[12.5px] font-extrabold text-muted">{i + 1}</span>
                    )}
                  </div>
                  <div
                    className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-white text-[13px] font-extrabold flex-none overflow-hidden"
                    style={{ background: avatarColor }}
                  >
                    {row.avatar_url ? <img src={row.avatar_url} alt="" className="w-full h-full object-cover" /> : initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-text truncate">
                      {row.display_name}
                      {isMe ? ` (${t("lead_you")})` : ""}
                    </div>
                  </div>
                  <div className="text-[13px] font-extrabold text-text flex-none">{row.score}</div>
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

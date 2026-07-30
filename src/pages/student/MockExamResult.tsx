import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { BottomTabs } from "../../components/BottomTabs";
import { TopBar } from "../../components/TopBar";
import { Drawer } from "../../components/Drawer";
import { Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { subjectColors } from "../../lib/icons";
import type { MockExamResultRow } from "../../lib/database.types";

function subjectNameToSlug(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, "-");
}

export default function MockExamResult() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { mockExamId } = useParams<{ mockExamId: string }>();
  const { profile } = useAuth();

  const [result, setResult] = useState<MockExamResultRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !mockExamId || !profile) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("mock_exam_results")
        .select("*")
        .eq("mock_exam_id", mockExamId)
        .eq("user_id", profile.id)
        .maybeSingle();
      setResult(data ?? null);
      setLoading(false);
    })();
  }, [mockExamId, profile]);

  const initial = (profile?.first_name?.[0] ?? "?").toUpperCase();
  const breakdownEntries = Object.entries(result?.breakdown ?? {});

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

        <div className="flex-1 min-h-0 overflow-auto px-5 pt-5 pb-[90px]">
          {loading ? (
            <Spinner />
          ) : !result ? (
            <EmptyState label={isSupabaseConfigured ? t("common_error") : t("backend_banner")} />
          ) : (
            <>
              <h2 className="font-serif font-bold text-[18px] text-ink-900 mb-4">{t("mockres_title")}</h2>

              <div className="bg-card rounded-2xl p-[26px] text-center shadow-[0_2px_12px_rgba(20,30,60,0.06)] mb-4">
                <div className="w-14 h-14 rounded-[16px] bg-success-100 flex items-center justify-center mx-auto mb-3.5 text-[26px]">🧬</div>
                <div className="font-serif font-extrabold text-[38px] mb-2">
                  <span className="text-ink-900">{result.score}</span>
                  <span className="text-[#c3cbd6]"> / 100</span>
                </div>
                <div className="flex flex-col gap-2.5 text-left border-t border-[#f0f2f5] pt-4">
                  <div className="flex justify-between text-[13px] text-ink-800">
                    <span>{t("mockres_national")}</span>
                    <b className="text-ink-900">{result.national_rank ? `#${result.national_rank}` : "—"}</b>
                  </div>
                  <div className="flex justify-between text-[13px] text-ink-800">
                    <span>{t("mockres_regional")}</span>
                    <b className="text-ink-900">{result.regional_rank ? `#${result.regional_rank}` : "—"}</b>
                  </div>
                </div>
              </div>

              {breakdownEntries.length > 0 && (
                <>
                  <div className="text-xs font-bold text-ink-900 mb-2.5">{t("mockres_breakdown")}</div>
                  <div className="flex flex-col gap-3">
                    {breakdownEntries.map(([name, pct]) => (
                      <div key={name}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-bold text-ink-900">{name}</span>
                          <span className="font-bold text-muted">{pct}%</span>
                        </div>
                        <div className="h-[7px] rounded-pill bg-ink-100 overflow-hidden">
                          <div className="h-full rounded-pill" style={{ width: `${pct}%`, background: subjectColors(subjectNameToSlug(name)).accent }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
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

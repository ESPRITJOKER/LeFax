import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { BottomTabs } from "../../components/BottomTabs";
import { Button, Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { MockExamResultRow } from "../../lib/database.types";

const SUBJECT_COLORS = ["var(--color-success-600)", "var(--color-ochre-600)", "var(--color-ink-700)"];

export default function MockExamResult() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { mockExamId } = useParams<{ mockExamId: string }>();
  const { profile } = useAuth();

  const [result, setResult] = useState<MockExamResultRow | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <PhoneFrame><Spinner /></PhoneFrame>;
  if (!result)
    return (
      <PhoneFrame>
        <EmptyState label={isSupabaseConfigured ? t("common_error") : t("backend_banner")} />
      </PhoneFrame>
    );

  const breakdownEntries = Object.entries(result.breakdown ?? {});

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col overflow-y-auto p-5 px-[22px] pb-6">
        <div className="font-serif font-bold text-xl text-ink-950 mb-4">{t("mockres_title")}</div>
        <div className="flex items-center justify-center gap-1.5 py-5.5 py-[22px]">
          <div className="text-[42px] font-extrabold text-ink-950">{result.score}</div>
          <div className="text-[15px] text-muted self-end mb-2">/100</div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <StatBox value={result.national_rank ? String(result.national_rank) : "—"} label={t("mockres_national")} />
          <StatBox value={result.regional_rank ? String(result.regional_rank) : "—"} label={t("mockres_regional")} />
        </div>
        <div className="text-xs font-bold text-ink-900 mb-2.5">{t("mockres_breakdown")}</div>
        <div className="flex flex-col gap-3 mb-5">
          {breakdownEntries.map(([name, pct], i) => (
            <div key={name}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-bold text-ink-900">{name}</span>
                <span className="font-bold text-muted">{pct}%</span>
              </div>
              <div className="h-[7px] rounded-pill bg-ink-100 overflow-hidden">
                <div className="h-full rounded-pill" style={{ width: `${pct}%`, background: SUBJECT_COLORS[i % SUBJECT_COLORS.length] }} />
              </div>
            </div>
          ))}
        </div>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          {t("result_seeCorrection")}
        </Button>
        <BottomTabs />
      </div>
    </PhoneFrame>
  );
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="p-3.5 rounded-xl bg-ink-50 text-center">
      <div className="text-[17px] font-extrabold text-ink-950">{value}</div>
      <div className="text-[10.5px] text-muted mt-0.5">{label}</div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { BottomTabs } from "../../components/BottomTabs";
import { Button, Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { MockExamRow } from "../../lib/database.types";

function formatCountdown(ms: number) {
  const clamped = Math.max(0, ms);
  const d = Math.floor(clamped / 86400000);
  const h = Math.floor((clamped % 86400000) / 3600000);
  const m = Math.floor((clamped % 3600000) / 60000);
  const s = Math.floor((clamped % 60000) / 1000);
  return `${d}j ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function MockExamHome() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  const [mock, setMock] = useState<MockExamRow | null>(null);
  const [loading, setLoading] = useState(true);
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
      const { data } = await supabase
        .from("mock_exams")
        .select("*")
        .in("status", ["scheduled", "open"])
        .order("opens_at")
        .limit(1);
      setMock(data?.[0] ?? null);
      setLoading(false);
    })();
  }, []);

  if (loading) return <PhoneFrame><Spinner /></PhoneFrame>;
  if (!mock)
    return (
      <PhoneFrame>
        <div className="flex-1 flex flex-col overflow-y-auto">
          <div className="px-[22px] pt-4 font-serif font-bold text-xl text-ink-950">{t("mock_title")}</div>
          <EmptyState label={isSupabaseConfigured ? t("mock_none") : t("backend_banner")} />
          <BottomTabs />
        </div>
      </PhoneFrame>
    );

  const opensAt = new Date(mock.opens_at).getTime();
  const isOpen = now >= opensAt && mock.status !== "closed";
  const instructions = lang === "fr" ? mock.instructions_fr : mock.instructions_en;

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="px-[22px] pt-4 font-serif font-bold text-xl text-ink-950">{lang === "fr" ? mock.title_fr : mock.title_en}</div>

        <div className="mx-[22px] my-4.5 my-[18px] p-5 rounded-2xl bg-ink-950 text-white text-center">
          <div className="text-[11.5px] opacity-75 font-semibold mb-1.5">{isOpen ? t("mock_title") : t("mock_opensIn")}</div>
          <div className="text-[26px] font-extrabold tabular-nums">{isOpen ? (lang === "fr" ? "Ouvert" : "Open") : formatCountdown(opensAt - now)}</div>
        </div>

        <div className="mx-[22px] grid grid-cols-3 gap-2.5">
          <StatBox value={`${mock.duration_minutes}min`} label={t("mock_duration")} />
          <StatBox value={String(mock.question_count)} label={t("mock_questions")} />
          <StatBox value={`${mock.passing_score}/100`} label={t("mock_passing")} />
        </div>

        <div className="mx-[22px] mt-5 mb-6 p-4 rounded-2xl border border-border">
          <div className="text-xs font-bold text-ink-900 mb-2">{t("mock_instructions")}</div>
          <ul className="list-disc pl-[18px] flex flex-col gap-1.5">
            {instructions.map((mi, i) => (
              <li key={i} className="text-xs text-ink-800 leading-normal">
                {mi}
              </li>
            ))}
          </ul>
        </div>

        <div className="px-[22px] pb-5.5 pb-[22px]">
          <Button disabled={!isOpen || !mock.quiz_id} onClick={() => mock.quiz_id && navigate(`/quiz/${mock.quiz_id}`)} className="w-full">
            {t("mock_start")}
          </Button>
        </div>
        <BottomTabs />
      </div>
    </PhoneFrame>
  );
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="p-3 rounded-xl bg-ink-50 text-center">
      <div className="text-[15px] font-extrabold text-ink-950">{value}</div>
      <div className="text-[10.5px] text-muted mt-0.5">{label}</div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Icon } from "../../lib/icons";
import { Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { MockExamRow } from "../../lib/database.types";

interface MockExamWithStats extends MockExamRow {
  participants: number;
  avgScore: string;
}

export default function AdminMockExams() {
  const { t, lang } = useI18n();
  const { profile } = useAuth();
  const [mocks, setMocks] = useState<MockExamWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [opensAt, setOpensAt] = useState("");
  const [duration, setDuration] = useState("180");
  const [passingScore, setPassingScore] = useState("50");

  async function load() {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const { data } = await supabase.from("mock_exams").select("*").order("opens_at", { ascending: false });
    const withStats: MockExamWithStats[] = [];
    for (const m of data ?? []) {
      const { data: results } = await supabase.from("mock_exam_results").select("score").eq("mock_exam_id", m.id);
      const scores = (results ?? []).map((r) => r.score);
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      withStats.push({ ...m, participants: scores.length, avgScore: avg !== null ? `${avg}/100` : "—" });
    }
    setMocks(withStats);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function scheduleMock() {
    if (!opensAt) return;
    const opens = new Date(opensAt);
    const closes = new Date(opens.getTime() + Number(duration) * 60000);
    await supabase.from("mock_exams").insert({
      title_fr: `Concours blanc — ${opensAt}`,
      title_en: `Mock exam — ${opensAt}`,
      opens_at: opens.toISOString(),
      closes_at: closes.toISOString(),
      duration_minutes: Number(duration),
      question_count: 60,
      passing_score: Number(passingScore),
      status: "scheduled",
      created_by: profile?.id,
    });
    setOpensAt("");
    await load();
  }

  return (
    <div>
      <div className="bg-white border border-border rounded-2xl p-5 mb-5">
        <div className="text-[13.5px] font-bold text-ink-900 mb-3.5">{t("admin_scheduleNew")}</div>
        <div className="grid gap-3 mb-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <Field label={lang === "fr" ? "Date d'ouverture" : "Opens at"}>
            <input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} className="px-2.5 py-2 rounded-lg border-[1.5px] border-border text-[13px]" />
          </Field>
          <Field label={t("mock_duration")}>
            <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="180" className="px-2.5 py-2 rounded-lg border-[1.5px] border-border text-[13px]" />
          </Field>
          <Field label={t("mock_passing")}>
            <input value={passingScore} onChange={(e) => setPassingScore(e.target.value)} placeholder="50" className="px-2.5 py-2 rounded-lg border-[1.5px] border-border text-[13px]" />
          </Field>
        </div>
        <button onClick={scheduleMock} className="px-4.5 py-2.5 rounded-xl border-none bg-ink-700 text-white text-[12.5px] font-bold">
          {t("admin_schedule")}
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {loading ? (
          <Spinner />
        ) : mocks.length === 0 ? (
          <EmptyState label={isSupabaseConfigured ? t("mock_none") : t("backend_banner")} />
        ) : (
          mocks.map((m) => (
            <div key={m.id} className="bg-white border border-border rounded-2xl px-4.5 px-[18px] py-4 flex items-center gap-4 flex-wrap">
              <div className="w-9 h-9 rounded-[10px] bg-ochre-100 flex items-center justify-center text-ochre-700 flex-none">
                <Icon name="calendar" size={17} />
              </div>
              <div className="flex-1 min-w-[160px]">
                <div className="text-[13.5px] font-bold text-ink-900">{lang === "fr" ? m.title_fr : m.title_en}</div>
                <div className="text-[11.5px] text-muted">
                  {new Date(m.opens_at).toLocaleString()} · {m.duration_minutes} min · {m.status}
                </div>
              </div>
              <div className="text-xs font-bold text-ink-800">
                {m.participants} {t("admin_participants")}
              </div>
              <div className="text-xs font-bold text-success-600">
                {t("admin_avgScore")} {m.avgScore}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11.5px] font-semibold text-ink-800">{label}</span>
      {children}
    </label>
  );
}

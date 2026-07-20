import { useEffect, useState } from "react";
import { Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";

interface QuizStat {
  quizId: string;
  titleFr: string;
  titleEn: string;
  attempts: number;
  avgScore: number;
}

export default function TeacherPerformance() {
  const { t, lang } = useI18n();
  const { profile } = useAuth();
  const [stats, setStats] = useState<QuizStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !profile) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("teacher", { body: { action: "performance_summary" } });
        if (error) throw error;
        setStats(data?.quizzes ?? []);
      } catch {
        setErrored(true);
      }
      setLoading(false);
    })();
  }, [profile]);

  return (
    <div className="flex flex-col gap-2.5">
      {loading ? (
        <Spinner />
      ) : errored || stats.length === 0 ? (
        <EmptyState label={isSupabaseConfigured ? (errored ? t("common_error") : t("common_error")) : t("backend_banner")} />
      ) : (
        stats.map((s) => (
          <div key={s.quizId} className="bg-white border border-border rounded-2xl px-4.5 px-[18px] py-3.5 flex items-center gap-3.5">
            <div className="flex-1">
              <div className="text-[13px] font-bold text-ink-900">{lang === "fr" ? s.titleFr : s.titleEn}</div>
              <div className="text-[11.5px] text-muted">
                {s.attempts} {lang === "fr" ? "tentatives" : "attempts"}
              </div>
            </div>
            <div className="text-sm font-extrabold text-success-600">{s.avgScore}%</div>
          </div>
        ))
      )}
    </div>
  );
}

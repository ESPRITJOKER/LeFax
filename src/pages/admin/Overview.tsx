import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon, type IconName } from "../../lib/icons";
import { SubjectBadge } from "../../components/SubjectBadge";
import { Spinner } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { SubjectRow } from "../../lib/database.types";

interface Stats {
  totalStudents: number;
  activeToday: number;
  lessonsCompleted: number;
  quizPassRate: number;
  mockParticipation: number;
  avgScore: number;
  faxcoinsDistributed: number;
  regionalBreakdown: { region: string; count: number }[];
}

/** A subject plus the size of the curriculum inside it. */
interface SubjectStat extends SubjectRow {
  chapters: number;
  lessons: number;
  published: number;
  drafts: number;
}

export default function AdminOverview() {
  const { t, lang } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [subjects, setSubjects] = useState<SubjectStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [
        { count: totalStudents },
        { count: activeToday },
        { count: lessonsCompleted },
        { data: attempts },
        { count: mockParticipation },
        { data: faxcoinsRows },
        { data: profilesByRegion },
        { data: subjectRows },
        { data: chapterRows },
        { data: lessonRows },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student"),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student").eq("last_active_on", today),
        supabase.from("lesson_progress").select("*", { count: "exact", head: true }).eq("status", "done"),
        supabase.from("quiz_attempts").select("score").not("score", "is", null),
        supabase.from("mock_exam_results").select("*", { count: "exact", head: true }),
        supabase.from("faxcoins_transactions").select("amount").gt("amount", 0),
        supabase.from("profiles").select("region").eq("role", "student"),
        // Curriculum shape per subject — three small reads folded into the
        // existing parallel batch rather than new round-trips.
        supabase.from("subjects").select("*").eq("track", "medicine").order("position"),
        supabase.from("chapters").select("id, subject_id"),
        supabase.from("lessons").select("id, chapter_id, published"),
      ]);

      const scores = (attempts ?? []).map((a) => a.score ?? 0);
      const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const passCount = scores.filter((s) => s >= 50).length;
      const quizPassRate = scores.length ? Math.round((passCount / scores.length) * 100) : 0;
      const faxcoinsDistributed = (faxcoinsRows ?? []).reduce((sum, r) => sum + r.amount, 0);

      const regionCounts: Record<string, number> = {};
      for (const p of profilesByRegion ?? []) {
        const key = p.region ?? (lang === "fr" ? "Non renseigné" : "Not set");
        regionCounts[key] = (regionCounts[key] ?? 0) + 1;
      }

      // chapter -> subject, so lessons (which only know their chapter) can be
      // attributed to a subject.
      const subjectOfChapter = new Map((chapterRows ?? []).map((c) => [c.id, c.subject_id]));
      setSubjects(
        (subjectRows ?? []).map((s) => {
          const lessons = (lessonRows ?? []).filter((l) => subjectOfChapter.get(l.chapter_id) === s.id);
          return {
            ...s,
            chapters: (chapterRows ?? []).filter((c) => c.subject_id === s.id).length,
            lessons: lessons.length,
            published: lessons.filter((l) => l.published).length,
            drafts: lessons.filter((l) => !l.published).length,
          };
        })
      );

      setStats({
        totalStudents: totalStudents ?? 0,
        activeToday: activeToday ?? 0,
        lessonsCompleted: lessonsCompleted ?? 0,
        quizPassRate,
        mockParticipation: mockParticipation ?? 0,
        avgScore,
        faxcoinsDistributed,
        regionalBreakdown: Object.entries(regionCounts).map(([region, count]) => ({ region, count })),
      });
      setLoading(false);
    })();
  }, [lang]);

  if (loading) return <Spinner />;
  if (!stats) return <div className="text-sm text-muted">{t("backend_banner")}</div>;

  function exportCsv() {
    if (!stats) return;
    const lines = [
      "metric,value",
      `total_students,${stats.totalStudents}`,
      `active_today,${stats.activeToday}`,
      `lessons_completed,${stats.lessonsCompleted}`,
      `quiz_pass_rate_pct,${stats.quizPassRate}`,
      `mock_participation,${stats.mockParticipation}`,
      `avg_score_pct,${stats.avgScore}`,
      `faxcoins_distributed,${stats.faxcoinsDistributed}`,
      "",
      "region,students",
      ...stats.regionalBreakdown.map((r) => `${r.region},${r.count}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lefax-overview.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const cards: { label: string; value: string | number; icon: IconName; bg: string; color: string }[] = [
    { label: lang === "fr" ? "Étudiants inscrits" : "Registered students", value: stats.totalStudents, icon: "users", bg: "bg-ink-100", color: "text-ink-700" },
    { label: lang === "fr" ? "Actifs aujourd'hui" : "Active today", value: stats.activeToday, icon: "chart", bg: "bg-success-50", color: "text-success-600" },
    { label: lang === "fr" ? "Leçons complétées" : "Lessons completed", value: stats.lessonsCompleted, icon: "book", bg: "bg-ink-100", color: "text-ink-700" },
    { label: lang === "fr" ? "Taux de réussite quiz" : "Quiz pass rate", value: `${stats.quizPassRate}%`, icon: "check", bg: "bg-success-50", color: "text-success-600" },
    { label: lang === "fr" ? "Participation concours blancs" : "Mock exam participation", value: stats.mockParticipation, icon: "target", bg: "bg-ochre-100", color: "text-ochre-700" },
    { label: lang === "fr" ? "Score moyen" : "Average score", value: `${stats.avgScore}%`, icon: "chart", bg: "bg-ochre-100", color: "text-ochre-700" },
    { label: "FaxCoins " + (lang === "fr" ? "distribués" : "issued"), value: stats.faxcoinsDistributed, icon: "coin", bg: "bg-ochre-100", color: "text-ochre-700" },
  ];

  return (
    <div>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        {cards.map((c) => (
          <div key={c.label} className="bg-white border border-border rounded-2xl p-4.5 p-[18px]">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className={`w-[34px] h-[34px] rounded-[10px] flex items-center justify-center ${c.bg} ${c.color}`}>
                <Icon name={c.icon} size={17} />
              </div>
              <div className="text-xs font-semibold text-muted">{c.label}</div>
            </div>
            <div className="text-[26px] font-extrabold text-ink-950">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Subjects — the whole medicine track at a glance, each card opening that
          subject's chapter tree. Icon and accent come from lib/icons, keyed by
          slug, so a subject reads the same here, on the student home and in the
          teacher panel. */}
      <div className="mt-6">
        <div className="flex items-baseline gap-2.5 mb-3">
          <div className="text-[13.5px] font-bold text-ink-900">{t("admin_subjects")}</div>
          <div className="text-[11.5px] text-muted">{t("admin_subjectsHint")}</div>
        </div>
        {subjects.length === 0 ? (
          <div className="bg-ink-50 border border-ink-100 rounded-2xl px-4 py-5 text-[13px] text-muted">{t("admin_noSubjects")}</div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
            {subjects.map((s) => {
              return (
                <Link
                  key={s.id}
                  to={`/admin/content?subject=${s.id}`}
                  className="bg-white border border-border rounded-2xl p-4 hover:bg-ink-50 block"
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    {/* Same badge the student home shows for this subject. */}
                    <SubjectBadge slug={s.slug} size={34} className="rounded-[10px]" />
                    <div className="text-[13px] font-bold text-ink-900 truncate">{lang === "fr" ? s.name_fr : s.name_en}</div>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted">
                    <span>
                      <strong className="text-ink-900">{s.chapters}</strong> {t("admin_chapters").toLowerCase()}
                    </span>
                    <span>
                      <strong className="text-ink-900">{s.lessons}</strong> {t("admin_lessons").toLowerCase()}
                    </span>
                    <span className="text-success-600">
                      <strong>{s.published}</strong> {t("admin_published").toLowerCase()}
                    </span>
                    {s.drafts > 0 && (
                      <span>
                        <strong className="text-ink-900">{s.drafts}</strong> {t("admin_draft").toLowerCase()}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6 bg-white border border-border rounded-2xl p-5">
        <div className="text-[13.5px] font-bold text-ink-900 mb-3.5">{lang === "fr" ? "Répartition régionale" : "Regional breakdown"}</div>
        <div className="flex flex-col gap-2.5">
          {stats.regionalBreakdown.map((r) => (
            <div key={r.region} className="flex justify-between text-xs">
              <span className="font-semibold text-ink-900">{r.region}</span>
              <span className="font-bold text-muted">{r.count}</span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={exportCsv} className="mt-5 px-4 py-2.5 rounded-xl border border-border bg-white text-xs font-bold text-ink-900">
        {t("admin_exportCsv")}
      </button>
    </div>
  );
}

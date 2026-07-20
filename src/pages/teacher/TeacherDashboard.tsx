import { useEffect, useState } from "react";
import { Icon } from "../../lib/icons";
import { Spinner } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";

export default function TeacherDashboard() {
  const { lang } = useI18n();
  const { profile } = useAuth();
  const [lessonCount, setLessonCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !profile) {
      setLoading(false);
      return;
    }
    (async () => {
      const { count: lessons } = await supabase.from("lessons").select("*", { count: "exact", head: true }).eq("author_id", profile.id);
      const { count: pending } = await supabase
        .from("content_approval")
        .select("*", { count: "exact", head: true })
        .eq("submitted_by", profile.id)
        .eq("status", "pending");
      setLessonCount(lessons ?? 0);
      setPendingCount(pending ?? 0);
      setLoading(false);
    })();
  }, [profile]);

  if (loading) return <Spinner />;

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
      <StatCard icon="book" label={lang === "fr" ? "Mes leçons" : "My lessons"} value={lessonCount} />
      <StatCard icon="wand" label={lang === "fr" ? "En attente de validation" : "Pending approval"} value={pendingCount} />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: "book" | "wand"; label: string; value: number }) {
  return (
    <div className="bg-white border border-border rounded-2xl p-4.5 p-[18px]">
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center bg-ink-100 text-ink-700">
          <Icon name={icon} size={17} />
        </div>
        <div className="text-xs font-semibold text-muted">{label}</div>
      </div>
      <div className="text-[26px] font-extrabold text-ink-950">{value}</div>
    </div>
  );
}

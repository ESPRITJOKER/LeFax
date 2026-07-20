import { useEffect, useState } from "react";
import { PhoneFrame } from "../../components/PhoneFrame";
import { ScreenHeader } from "../../components/ScreenHeader";
import { Icon } from "../../lib/icons";
import { Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { DailyTaskRow } from "../../lib/database.types";

export default function Tasks() {
  const { t, lang } = useI18n();
  const { profile, refreshProfile } = useAuth();

  const [tasks, setTasks] = useState<DailyTaskRow[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [rewardedLimit, setRewardedLimit] = useState(5);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function load() {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const { data: taskRows } = await supabase.from("daily_tasks").select("*").eq("active", true).order("sort_order");
    setTasks(taskRows ?? []);
    const { data: settingRow } = await supabase.from("settings").select("value").eq("key", "daily_tasks_rewarded_limit").maybeSingle();
    if (settingRow?.value) setRewardedLimit(Number(settingRow.value));
    if (profile) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: completions } = await supabase
        .from("daily_task_completions")
        .select("task_id")
        .eq("user_id", profile.id)
        .eq("completed_on", today);
      setCompletedIds(new Set((completions ?? []).map((c) => c.task_id)));
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function complete(task: DailyTaskRow) {
    setPendingId(task.id);
    try {
      const { error } = await supabase.functions.invoke("daily-tasks", { body: { action: "complete", task_id: task.id } });
      if (error) throw error;
      await refreshProfile();
      await load();
    } catch {
      // Backend not reachable yet.
    }
    setPendingId(null);
  }

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col overflow-y-auto">
        <ScreenHeader title={t("tasks_title")} />
        <div className="px-[22px] pt-3.5 pb-1.5 text-xs font-bold text-muted">
          {completedIds.size}/{rewardedLimit} {t("tasks_limit")}
        </div>
        <div className="px-[22px] pt-2 pb-6 flex flex-col gap-2.5">
          {loading ? (
            <Spinner />
          ) : tasks.length === 0 ? (
            <EmptyState label={isSupabaseConfigured ? t("common_error") : t("backend_banner")} />
          ) : (
            tasks.map((task) => {
              const done = completedIds.has(task.id);
              const capped = completedIds.size >= rewardedLimit && !done;
              return (
                <div key={task.id} className="flex items-center gap-3 p-3.5 rounded-2xl border border-border">
                  <div className="w-[38px] h-[38px] flex-none rounded-[11px] bg-ink-50 flex items-center justify-center text-ink-800">
                    <Icon name="thumbsup" size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold text-ink-900">{lang === "fr" ? task.label_fr : task.label_en}</div>
                    <div className="text-[11px] font-bold text-ochre-700 mt-0.5">+{task.reward_coins} FaxCoins</div>
                  </div>
                  <button
                    disabled={done || capped || pendingId === task.id}
                    onClick={() => complete(task)}
                    className={`px-3.5 py-2 rounded-[9px] border-none text-[11.5px] font-bold ${
                      done ? "bg-success-100 text-success-600" : "bg-ink-700 text-white disabled:bg-ink-100 disabled:text-muted"
                    }`}
                  >
                    {done ? (lang === "fr" ? "Fait" : "Done") : lang === "fr" ? "Faire" : "Do it"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}

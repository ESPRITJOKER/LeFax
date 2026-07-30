import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { BottomTabs } from "../../components/BottomTabs";
import { TopBar } from "../../components/TopBar";
import { Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured, invokeFn } from "../../lib/supabaseClient";
import type { DailyTaskRow } from "../../lib/database.types";

export default function Tasks() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
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
      const { error } = await invokeFn("daily-tasks", { action: "complete", task_id: task.id });
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
      <div className="flex-1 min-h-0 flex flex-col">
        <TopBar variant="back" coins={profile?.faxcoins ?? 0} onBack={() => navigate("/dashboard")} />

        <div className="flex-1 min-h-0 overflow-auto px-5 pt-4 pb-[90px]">
          <h2 className="font-serif font-bold text-[18px] text-ink-900 mb-1">{lang === "fr" ? "Tâches du jour" : "Daily tasks"}</h2>

          <div className="bg-brand-800 rounded-[14px] px-[18px] py-4 flex items-center justify-between my-3.5">
            <div className="font-serif font-bold text-[14px] text-white">{lang === "fr" ? "Série en cours" : "Current streak"}</div>
            <div className="bg-ochre-600 text-ink-900 font-serif font-extrabold text-[16px] rounded-[10px] px-3 py-2">{profile?.streak_count ?? 0} 🔥</div>
          </div>

          {loading ? (
            <Spinner />
          ) : tasks.length === 0 ? (
            <EmptyState label={isSupabaseConfigured ? (lang === "fr" ? "Aucune tâche" : "No tasks") : t("backend_banner")} />
          ) : (
            tasks.map((task) => {
              const done = completedIds.has(task.id);
              const capped = completedIds.size >= rewardedLimit && !done;
              const disabled = done || capped || pendingId === task.id;
              return (
                <div
                  key={task.id}
                  onClick={() => !disabled && complete(task)}
                  className={`flex items-center gap-3.5 bg-card rounded-[12px] px-4 py-3.5 shadow-[0_2px_8px_rgba(20,30,60,0.05)] mb-2.5 ${
                    done ? "opacity-55" : capped ? "" : "cursor-pointer"
                  }`}
                >
                  <div
                    className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center flex-shrink-0"
                    style={{ background: done ? "#dcf5e3" : "#eef8ff" }}
                  >
                    {done ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M5 12l5 5L20 7" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="8" stroke="#29b6f6" strokeWidth="1.8" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-serif font-semibold text-[13.5px] text-ink-900">{lang === "fr" ? task.label_fr : task.label_en}</div>
                    <div className="text-[11.5px] text-muted mt-0.5">
                      {done ? (lang === "fr" ? "Terminé" : "Done") : capped ? (lang === "fr" ? "Limite atteinte" : "Limit reached") : lang === "fr" ? "À faire" : "To do"}
                    </div>
                  </div>
                  <div className="font-serif font-bold text-[12px] text-ochre-600">+{task.reward_coins}</div>
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

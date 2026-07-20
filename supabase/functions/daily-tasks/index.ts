// daily-tasks — Tâches quotidiennes (CDC 6.6 / section 10 "Tâches quotidiennes:
// liste, validation, récompense")
//
// Enforces the admin-configurable cap on rewarded tasks per day
// (public.settings.daily_tasks_rewarded_limit) and does the FaxCoins credit
// server-side.

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, getUserClientAndUser } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const { user, error: authError } = await getUserClientAndUser(req);
  if (authError || !user) return jsonResponse({ error: "unauthorized" }, 401);

  try {
    const { action, task_id } = await req.json();
    if (action !== "complete" || !task_id) return jsonResponse({ error: "unknown action" }, 400);

    const admin = getServiceClient();
    const today = new Date().toISOString().slice(0, 10);

    const { data: task } = await admin.from("daily_tasks").select("*").eq("id", task_id).eq("active", true).maybeSingle();
    if (!task) return jsonResponse({ error: "task not found" }, 404);

    const { data: existing } = await admin
      .from("daily_task_completions")
      .select("id")
      .eq("user_id", user.id)
      .eq("task_id", task_id)
      .eq("completed_on", today)
      .maybeSingle();
    if (existing) return jsonResponse({ error: "already completed today" }, 409);

    const { data: limitSetting } = await admin.from("settings").select("value").eq("key", "daily_tasks_rewarded_limit").maybeSingle();
    const rewardedLimit = Number(limitSetting?.value ?? 5);

    const { count: completedToday } = await admin
      .from("daily_task_completions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("completed_on", today);

    const withinRewardCap = (completedToday ?? 0) < rewardedLimit;
    const rewardCoins = withinRewardCap ? task.reward_coins : 0;

    await admin.from("daily_task_completions").insert({ user_id: user.id, task_id, completed_on: today, reward_coins: rewardCoins });

    if (rewardCoins > 0) {
      const { data: profile } = await admin.from("profiles").select("faxcoins").eq("id", user.id).single();
      const newBalance = (profile?.faxcoins ?? 0) + rewardCoins;
      await admin.from("profiles").update({ faxcoins: newBalance }).eq("id", user.id);
      await admin.from("faxcoins_transactions").insert({
        user_id: user.id,
        amount: rewardCoins,
        reason: "task_complete",
        reference_id: task_id,
        balance_after: newBalance,
      });
    }

    return jsonResponse({ ok: true, rewardCoins, capped: !withinRewardCap });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});

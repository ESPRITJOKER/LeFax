// rankings — Classements (CDC 6.11 / section 10 "classements")
//
// Reading the leaderboard is a plain public-read query the client already
// does directly against `rankings` (denormalized, so it never touches
// another student's `profiles` row — see 0001_init.sql). This function is
// the write path: aggregating raw activity (quiz scores this week) into the
// `rankings` table. Mock-exam-specific national/regional ranks are computed
// by the `mock-exams` function instead; this one covers the general
// "meilleurs scores hebdomadaires" / "meilleurs collecteurs FaxCoins" cases
// from CDC 6.11 that aren't tied to a single mock exam.
//
// Intended to run on a schedule (e.g. a Supabase cron trigger calling this
// function nightly) rather than per-request from the client — exposed here
// as an admin-triggerable action for the scaffold.

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, getUserClientAndUser } from "../_shared/supabaseAdmin.ts";

function startOfWeek(d: Date) {
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday as start of week
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const { user, error: authError } = await getUserClientAndUser(req);
  if (authError || !user) return jsonResponse({ error: "unauthorized" }, 401);

  const admin = getServiceClient();
  const { data: caller } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!caller || !["admin", "super_admin"].includes(caller.role)) return jsonResponse({ error: "forbidden" }, 403);

  try {
    const { action } = await req.json();
    if (action !== "compute_weekly") return jsonResponse({ error: "unknown action" }, 400);

    const weekStart = startOfWeek(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

    const { data: attempts } = await admin
      .from("quiz_attempts")
      .select("user_id, score")
      .gte("submitted_at", weekStart.toISOString())
      .not("score", "is", null);

    const totalsByUser = new Map<string, number>();
    for (const a of (attempts ?? []) as { user_id: string; score: number }[]) {
      totalsByUser.set(a.user_id, (totalsByUser.get(a.user_id) ?? 0) + a.score);
    }

    const { data: profiles } = await admin.from("profiles").select("id, first_name, last_name, town, region").in("id", [...totalsByUser.keys()]);
    const profileById = new Map((profiles ?? []).map((p: { id: string }) => [p.id, p]));

    let written = 0;
    for (const [userId, score] of totalsByUser) {
      const p = profileById.get(userId);
      if (!p) continue;
      await admin.from("rankings").upsert(
        {
          scope: "weekly",
          user_id: userId,
          display_name: `${p.first_name} ${p.last_name.charAt(0)}.`,
          town: p.town,
          score,
          period_start: weekStart.toISOString().slice(0, 10),
          period_end: weekEnd.toISOString().slice(0, 10),
        },
        { onConflict: "scope,region,user_id,period_start" }
      );
      written += 1;
    }

    return jsonResponse({ ok: true, written });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});

// mock-exams — Concours blancs (CDC 6.7 / section 10 "Mock Exams: programmation,
// participation, résultats, classement")
//
// Scheduling (opens_at/closes_at/duration/passing_score/instructions) is a
// simple admin-only table write handled directly by the Admin panel
// (RLS: mock_exams_write). Taking the exam reuses the generic quiz flow
// (see quiz-submit, which already records a bare mock_exam_results row).
// This function implements the part that's genuinely "sensitive logic":
// computing national/regional ranks once a mock exam closes.

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, getUserClientAndUser } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const { user, error: authError } = await getUserClientAndUser(req);
  if (authError || !user) return jsonResponse({ error: "unauthorized" }, 401);

  try {
    const { action, mock_exam_id } = await req.json();
    if (action !== "compute_results" || !mock_exam_id) return jsonResponse({ error: "unknown action" }, 400);

    const admin = getServiceClient();

    // Only admins/super_admins may trigger the ranking computation (typically
    // called by a scheduled job right after `closes_at`, but exposed here so
    // an admin can also trigger it manually from the back-office).
    const { data: caller } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (!caller || !["admin", "super_admin"].includes(caller.role)) return jsonResponse({ error: "forbidden" }, 403);

    const { data: results } = await admin
      .from("mock_exam_results")
      .select("*, profiles!inner(region, first_name, last_name, town)")
      .eq("mock_exam_id", mock_exam_id);

    const rows = (results ?? []) as Array<{
      id: string;
      user_id: string;
      score: number;
      profiles: { region: string | null; first_name: string; last_name: string; town: string | null };
    }>;

    const nationalSorted = [...rows].sort((a, b) => b.score - a.score);
    const nationalRankByUser = new Map(nationalSorted.map((r, i) => [r.user_id, i + 1]));

    const byRegion = new Map<string, typeof rows>();
    for (const r of rows) {
      const region = r.profiles.region ?? "unknown";
      if (!byRegion.has(region)) byRegion.set(region, []);
      byRegion.get(region)!.push(r);
    }
    const regionalRankByUser = new Map<string, number>();
    for (const [, regionRows] of byRegion) {
      const sorted = [...regionRows].sort((a, b) => b.score - a.score);
      sorted.forEach((r, i) => regionalRankByUser.set(r.user_id, i + 1));
    }

    const { data: mock } = await admin.from("mock_exams").select("*").eq("id", mock_exam_id).single();

    for (const r of rows) {
      await admin
        .from("mock_exam_results")
        .update({ national_rank: nationalRankByUser.get(r.user_id), regional_rank: regionalRankByUser.get(r.user_id) })
        .eq("id", r.id);

      // Denormalized rankings rows power the public leaderboard (CDC 6.11)
      // without exposing other students' `profiles` rows to the client.
      const displayName = `${r.profiles.first_name} ${r.profiles.last_name.charAt(0)}.`;
      await admin.from("rankings").upsert(
        {
          scope: "national",
          user_id: r.user_id,
          display_name: displayName,
          town: r.profiles.town,
          score: r.score,
          period_start: mock.opens_at.slice(0, 10),
          period_end: mock.closes_at.slice(0, 10),
        },
        { onConflict: "scope,region,user_id,period_start" }
      );
      await admin.from("rankings").upsert(
        {
          scope: "regional",
          region: r.profiles.region,
          user_id: r.user_id,
          display_name: displayName,
          town: r.profiles.town,
          score: r.score,
          period_start: mock.opens_at.slice(0, 10),
          period_end: mock.closes_at.slice(0, 10),
        },
        { onConflict: "scope,region,user_id,period_start" }
      );
    }

    await admin.from("mock_exams").update({ status: "closed" }).eq("id", mock_exam_id);

    return jsonResponse({ ok: true, ranked: rows.length });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});

// courses — Cours (CDC 6.3 / section 10 "Cours: matières, chapitres, leçons, progression")
//
// Reads of subjects/chapters/lessons/lesson_progress are simple enough that
// the frontend queries Supabase directly (RLS-safe: `lessons_read`,
// `lesson_progress_own`). This function handles the one bit of course logic
// that is a *side effect* rather than a read, and per CDC 8.1 must run
// server-side: awarding a FaxCoins bonus the moment a chapter becomes fully
// completed (CDC 6.5: "chapitres complétés" is a FaxCoins-earning event).

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, getUserClientAndUser } from "../_shared/supabaseAdmin.ts";

const CHAPTER_COMPLETE_BONUS = 15;

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const { user, error: authError } = await getUserClientAndUser(req);
  if (authError || !user) return jsonResponse({ error: "unauthorized" }, 401);

  try {
    const { action, lesson_id } = await req.json();
    if (action !== "complete_lesson" || !lesson_id) return jsonResponse({ error: "unknown action" }, 400);

    const admin = getServiceClient();

    // Mark the lesson done for this user.
    await admin
      .from("lesson_progress")
      .upsert(
        { user_id: user.id, lesson_id, status: "done", progress_pct: 100, completed_at: new Date().toISOString() },
        { onConflict: "user_id,lesson_id" }
      );

    // Check whether every lesson in the parent chapter is now done.
    const { data: lesson } = await admin.from("lessons").select("chapter_id").eq("id", lesson_id).maybeSingle();
    if (!lesson) return jsonResponse({ ok: true, chapterCompleted: false });

    const { data: siblingLessons } = await admin.from("lessons").select("id").eq("chapter_id", lesson.chapter_id);
    const siblingIds = (siblingLessons ?? []).map((l: { id: string }) => l.id);

    const { data: doneRows } = await admin
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", user.id)
      .eq("status", "done")
      .in("lesson_id", siblingIds);

    const chapterCompleted = siblingIds.length > 0 && (doneRows ?? []).length === siblingIds.length;

    if (chapterCompleted) {
      const { data: profile } = await admin.from("profiles").select("faxcoins").eq("id", user.id).single();
      const newBalance = (profile?.faxcoins ?? 0) + CHAPTER_COMPLETE_BONUS;
      await admin.from("profiles").update({ faxcoins: newBalance }).eq("id", user.id);
      await admin.from("faxcoins_transactions").insert({
        user_id: user.id,
        amount: CHAPTER_COMPLETE_BONUS,
        reason: "chapter_complete",
        reference_id: lesson.chapter_id,
        balance_after: newBalance,
      });
    }

    return jsonResponse({ ok: true, chapterCompleted, bonusAwarded: chapterCompleted ? CHAPTER_COMPLETE_BONUS : 0 });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});

// teacher — Enseignant (CDC 6.10 / section 10 "Enseignant: dépôt contenu,
// suivi performance")
//
// Content upload and quiz creation are simple RLS-scoped table writes done
// directly by the Teacher panel (`lessons_write_teacher_own`,
// `quizzes_write`). This function covers the one thing better done as a
// single server-side aggregate query than N client round-trips: performance
// stats across all of a teacher's own content.

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, getUserClientAndUser } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const { user, error: authError } = await getUserClientAndUser(req);
  if (authError || !user) return jsonResponse({ error: "unauthorized" }, 401);

  try {
    const { action } = await req.json();
    if (action !== "performance_summary") return jsonResponse({ error: "unknown action" }, 400);

    const admin = getServiceClient();

    const { data: caller } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (!caller || !["teacher", "admin", "super_admin"].includes(caller.role)) return jsonResponse({ error: "forbidden" }, 403);

    const { data: lessons } = await admin.from("lessons").select("id, title_fr, title_en").eq("author_id", user.id);
    const lessonIds = (lessons ?? []).map((l: { id: string }) => l.id);
    if (!lessonIds.length) return jsonResponse({ quizzes: [] });

    const { data: quizzes } = await admin.from("quizzes").select("*").in("lesson_id", lessonIds);
    const quizIds = (quizzes ?? []).map((q: { id: string }) => q.id);
    const { data: attempts } = quizIds.length
      ? await admin.from("quiz_attempts").select("quiz_id, score").in("quiz_id", quizIds).not("score", "is", null)
      : { data: [] };

    const summary = (quizzes ?? []).map((q: { id: string; title_fr: string; title_en: string; lesson_id: string }) => {
      const relevant = (attempts ?? []).filter((a: { quiz_id: string }) => a.quiz_id === q.id);
      const scores = relevant.map((a: { score: number }) => a.score);
      return {
        quizId: q.id,
        lessonId: q.lesson_id,
        titleFr: q.title_fr,
        titleEn: q.title_en,
        attempts: scores.length,
        avgScore: scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0,
      };
    });

    return jsonResponse({ quizzes: summary });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});

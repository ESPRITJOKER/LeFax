// search — Recherche globale (CDC 6.11 / section 10 "recherche: leçons,
// matières, chapitres, anciens sujets, questions")
//
// Consolidates what would otherwise be 4 separate client round-trips (one
// ILIKE query per table) into a single call. All tables searched here are
// public-read for authenticated users (see 0001_init.sql), so this uses the
// caller's own JWT rather than the service role — no elevated privilege
// needed, just fewer requests.
//
// TODO: once pgvector embeddings are populated for lesson content, swap the
// ILIKE queries below for a `<->` cosine-distance search for real semantic
// search (the `vector` extension is already enabled in 0001_init.sql).

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getUserClientAndUser } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const { client, user, error: authError } = await getUserClientAndUser(req);
  if (authError || !user) return jsonResponse({ error: "unauthorized" }, 401);

  try {
    const { query, lang } = await req.json();
    if (!query || typeof query !== "string") return jsonResponse({ error: "query is required" }, 400);

    const nameField = lang === "en" ? "name_en" : "name_fr";
    const titleField = lang === "en" ? "title_en" : "title_fr";
    const textField = lang === "en" ? "text_en" : "text_fr";
    const like = `%${query}%`;

    const [subjects, chapters, lessons, questions] = await Promise.all([
      client.from("subjects").select("id, slug").ilike(nameField, like).limit(10),
      client.from("chapters").select("id").ilike(nameField, like).limit(10),
      client.from("lessons").select("id").ilike(titleField, like).limit(10),
      client.from("questions").select("id, quiz_id").ilike(textField, like).limit(10),
    ]);

    return jsonResponse({
      subjects: subjects.data ?? [],
      chapters: chapters.data ?? [],
      lessons: lessons.data ?? [],
      questions: questions.data ?? [],
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});

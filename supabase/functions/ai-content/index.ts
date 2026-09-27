// ai-content — Moteur IA de génération de contenu (CDC 6.8 / section 10
// "Contenu IA: soumission document source, génération, statut validation")
//
// `generate` turns a teacher's source document (or the lesson body itself) into
// draft material. `approve` is the publish step: it materialises an approved
// submission into quizzes/questions/choices, and is the ONLY path that writes
// AI output into the live question bank — which is how CDC 6.8's "aucun contenu
// généré n'est publié sans relecture/modification/approbation explicite" is
// enforced. Teachers review and edit, then submit; an admin approves.
//
// Authorization (0018): `generate` requires the caller to hold an active grant
// on the lesson's subject, so a teacher cannot aim the generator at somebody
// else's subject by passing a foreign lesson_id. `approve` stays admin-only.
//
// ANTHROPIC_API_KEY must be set as an Edge Function secret for `generate`.

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, getUserClientAndUser } from "../_shared/supabaseAdmin.ts";

declare const Deno: { env: { get(key: string): string | undefined } };

const ANTHROPIC_MODEL = "claude-sonnet-4-5";
const SOURCE_BUCKET = "lesson-sources";
/** Plain-text-ish types we can read directly; anything else needs a parser. */
const TEXTUAL = [".txt", ".md", ".markdown", ".csv", ".json", ".htm", ".html"];
const MAX_SOURCE_CHARS = 24000;

type Admin = ReturnType<typeof getServiceClient>;

async function getRole(admin: Admin, userId: string): Promise<string | null> {
  const { data } = await admin.from("profiles").select("role, status").eq("id", userId).maybeSingle();
  if (!data || data.status !== "active") return null;
  return data.role ?? null;
}

/** Does the caller hold an active grant on this lesson's subject? Admins: always. */
async function mayAuthorLesson(admin: Admin, userId: string, role: string, lessonId: string): Promise<boolean> {
  if (role === "admin" || role === "super_admin") return true;
  const { data: lesson } = await admin.from("lessons").select("chapter_id, author_id").eq("id", lessonId).maybeSingle();
  if (!lesson || lesson.author_id !== userId) return false;
  const { data: chapter } = await admin.from("chapters").select("subject_id").eq("id", lesson.chapter_id).maybeSingle();
  if (!chapter) return false;
  const { data: grant } = await admin
    .from("teacher_subjects")
    .select("id")
    .eq("teacher_id", userId)
    .eq("subject_id", chapter.subject_id)
    .eq("status", "active")
    .maybeSingle();
  return !!grant;
}

/**
 * Pull readable text out of an uploaded source document.
 * Text formats are decoded directly. PDF/Word/slides need a real parser, which
 * we do not ship yet: rather than sending binary noise to the model we say so
 * and fall back to the lesson body, and the response reports what happened so
 * the UI can tell the teacher instead of silently producing worse questions.
 */
async function extractSourceText(admin: Admin, mediaId: string): Promise<{ text: string; note: string | null }> {
  const { data: media } = await admin.from("media_library").select("storage_path, file_name, mime_type").eq("id", mediaId).maybeSingle();
  if (!media) return { text: "", note: "source_not_found" };

  const name = (media.file_name ?? "").toLowerCase();
  const isTextual = TEXTUAL.some((ext) => name.endsWith(ext)) || (media.mime_type ?? "").startsWith("text/");
  if (!isTextual) return { text: "", note: "unsupported_source_format" };

  const { data: file, error } = await admin.storage.from(SOURCE_BUCKET).download(media.storage_path);
  if (error || !file) return { text: "", note: "source_download_failed" };

  const raw = await file.text();
  // Strip tags for .html sources; harmless for the rest.
  const text = raw.replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").trim();
  return { text: text.slice(0, MAX_SOURCE_CHARS), note: text.length > MAX_SOURCE_CHARS ? "source_truncated" : null };
}

/** The bilingual house style every generated item must follow. */
function buildPrompt(opts: {
  contentType: string;
  count: number;
  level: string;
  topic: string;
  objectives: string;
  sourceText: string;
}): string {
  const { contentType, count, level, topic, objectives, sourceText } = opts;

  const notation = [
    "Notation: write mathematics as TeX between single dollars for inline ($\\frac{a}{b}$) or double dollars for display ($$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$$),",
    "and chemistry with mhchem (\\ce{2H2 + O2 -> 2H2O}, \\ce{SO4^2-}). Never write formulas as plain text like H2SO4 or lim(x->0).",
  ].join(" ");

  const shared = [
    `Context: a Cameroonian medicine-school entrance exam prep app, bilingual French/English. Target level: ${level || "concours d'entrée en médecine"}.`,
    topic ? `Focus topic: ${topic}.` : "",
    objectives ? `Learning objectives to cover: ${objectives}.` : "",
    notation,
    "French is the primary language; the English fields must be a faithful translation, not a paraphrase.",
  ]
    .filter(Boolean)
    .join("\n");

  if (contentType === "lesson" || contentType === "summary") {
    const what = contentType === "lesson" ? "a micro-learning lesson body" : "a chapter summary";
    return [
      shared,
      `Task: produce ${what} as a JSON object with exactly these keys: { "content_fr": string, "content_en": string, "summary_fr": string, "summary_en": string, "key_points_fr": string[], "key_points_en": string[] }.`,
      'The body uses this line-based markup: "## Heading", "### Sub-heading", "- bullet", "[[IMG: caption describing the diagram to upload]]", "[!PIEGE] common exam trap", "[!INFO] note", "[!APP] exercise ||| correction". Inline **bold**, *italic*, ==highlight==, __underline__.',
      "Return JSON only, no prose around it.",
      "",
      "Source material:",
      sourceText,
    ].join("\n");
  }

  const kind =
    contentType === "true_false"
      ? 'true/false questions (exactly 2 options: "Vrai"/"Faux" in FR, "True"/"False" in EN)'
      : contentType === "short_answer"
        ? "short-answer questions (put the expected answer in explanation_fr/explanation_en and provide a single option holding the model answer)"
        : "multiple-choice questions (QCM) with exactly 4 options and exactly one is_correct=true";

  return [
    shared,
    `Task: produce ${count} ${kind} as a JSON array. Each item: { "text_fr": string, "text_en": string, "explanation_fr": string, "explanation_en": string, "difficulty": "easy" | "medium" | "hard", "options": [{ "text_fr": string, "text_en": string, "is_correct": boolean }] }.`,
    'Set "difficulty" from the cognitive demand: "easy" = direct recall of a single fact, "medium" = applying/linking two ideas, "hard" = multi-step reasoning or a fine distinction. Aim for a spread.',
    "The explanation must say why the correct option is correct AND why the tempting wrong one is wrong.",
    "Return JSON only, no prose around it.",
    "",
    "Source material:",
    sourceText,
  ].join("\n");
}

/** Claude sometimes wraps JSON in prose or a fenced block; recover it. */
function parseModelJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.search(/[[{]/);
    const end = Math.max(candidate.lastIndexOf("]"), candidate.lastIndexOf("}"));
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error("the model did not return valid JSON");
  }
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const { user, error: authError } = await getUserClientAndUser(req);
  if (authError || !user) return jsonResponse({ error: "unauthorized" }, 401);

  try {
    const body = await req.json();
    const admin = getServiceClient();
    const role = await getRole(admin, user.id);
    if (!role || !["teacher", "admin", "super_admin"].includes(role)) return jsonResponse({ error: "forbidden" }, 403);

    if (body.action === "generate") {
      const { lesson_id, media_id } = body;
      if (!lesson_id) return jsonResponse({ error: "lesson_id is required" }, 400);

      if (!(await mayAuthorLesson(admin, user.id, role, lesson_id))) {
        return jsonResponse({ error: "forbidden: that lesson is not yours, or not one of your subjects" }, 403);
      }

      const { data: lesson } = await admin.from("lessons").select("*").eq("id", lesson_id).maybeSingle();
      if (!lesson) return jsonResponse({ error: "lesson not found" }, 404);

      // Prefer the uploaded document; fall back to the lesson body, and say which.
      let sourceText = `${lesson.title_fr}\n\n${lesson.content_fr ?? ""}`.trim();
      let sourceNote: string | null = null;
      let usedSource = "lesson_body";
      if (media_id) {
        const extracted = await extractSourceText(admin, media_id);
        sourceNote = extracted.note;
        if (extracted.text) {
          sourceText = extracted.text;
          usedSource = "uploaded_document";
        }
      }
      if (!sourceText) return jsonResponse({ error: "nothing to work from: the lesson body is empty and no readable source was attached" }, 422);

      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!apiKey) {
        return jsonResponse({ error: "ANTHROPIC_API_KEY not configured — see .env.example and README for setup steps." }, 503);
      }

      const contentType = typeof body.content_type === "string" ? body.content_type : "mcq";
      const count = Math.min(Math.max(Number(body.count) || 5, 1), 15);

      const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: buildPrompt({
                contentType,
                count,
                level: String(body.level ?? ""),
                topic: String(body.topic ?? ""),
                objectives: String(body.objectives ?? ""),
                sourceText,
              }),
            },
          ],
        }),
      });

      if (!anthropicResponse.ok) {
        const errText = await anthropicResponse.text();
        return jsonResponse({ error: `Anthropic API error: ${errText}` }, 502);
      }

      const anthropicJson = await anthropicResponse.json();
      const textBlock = anthropicJson?.content?.[0]?.text ?? "";
      let parsed: unknown;
      try {
        parsed = parseModelJson(textBlock);
      } catch (err) {
        return jsonResponse({ error: String(err instanceof Error ? err.message : err) }, 502);
      }

      if (contentType === "lesson" || contentType === "summary") {
        return jsonResponse({ lesson: parsed, source: usedSource, sourceNote });
      }
      const questions = Array.isArray(parsed) ? parsed : [];
      return jsonResponse({ questions, source: usedSource, sourceNote });
    }

    if (body.action === "approve") {
      const { content_approval_id } = body;
      if (!content_approval_id) return jsonResponse({ error: "content_approval_id is required" }, 400);
      if (!["admin", "super_admin"].includes(role)) return jsonResponse({ error: "forbidden" }, 403);

      const { data: submission } = await admin.from("content_approval").select("*").eq("id", content_approval_id).maybeSingle();
      if (!submission || submission.status === "approved") return jsonResponse({ error: "not found or already approved" }, 404);
      if (submission.kind === "lesson") {
        return jsonResponse({ error: "lesson submissions are reviewed with the admin function's review_lesson action" }, 409);
      }

      const q = submission.generated_payload as {
        text_fr: string;
        text_en: string;
        explanation_fr?: string;
        explanation_en?: string;
        difficulty?: string;
        options: { text_fr: string; text_en: string; is_correct: boolean }[];
      };

      // Never materialise a broken question: the runner assumes >= 2 options
      // and exactly one correct answer.
      const options = Array.isArray(q?.options) ? q.options : [];
      if (options.length < 2) return jsonResponse({ error: "invalid submission: at least 2 options are required" }, 422);
      if (options.filter((o) => o.is_correct).length !== 1) {
        return jsonResponse({ error: "invalid submission: exactly one option must be marked correct" }, 422);
      }
      if (!q.text_fr?.trim()) return jsonResponse({ error: "invalid submission: the French question text is empty" }, 422);

      // Difficulty carried on the payload (set by the generator, or by the
      // teacher/admin in the review UI). Validate against the enum.
      const difficulty = ["easy", "medium", "hard"].includes(q.difficulty ?? "") ? (q.difficulty as string) : "medium";

      // Find or create the lesson's quiz, then attach the approved question.
      let quizId: string | null = null;
      if (submission.lesson_id) {
        const { data: existingQuiz } = await admin.from("quizzes").select("id").eq("lesson_id", submission.lesson_id).maybeSingle();
        if (existingQuiz) {
          quizId = existingQuiz.id;
        } else {
          const { data: lesson } = await admin.from("lessons").select("title_fr, title_en").eq("id", submission.lesson_id).single();
          const { data: newQuiz } = await admin
            .from("quizzes")
            .insert({ lesson_id: submission.lesson_id, title_fr: `Test — ${lesson.title_fr}`, title_en: `Test — ${lesson.title_en}` })
            .select()
            .single();
          quizId = newQuiz?.id ?? null;
        }
      }
      if (!quizId) return jsonResponse({ error: "could not resolve target quiz" }, 500);

      const { data: nextPos } = await admin.from("questions").select("position").eq("quiz_id", quizId).order("position", { ascending: false }).limit(1);
      const position = nextPos?.length ? (nextPos[0].position ?? 0) + 1 : 0;

      const { data: newQuestion } = await admin
        .from("questions")
        .insert({
          quiz_id: quizId,
          text_fr: q.text_fr,
          text_en: q.text_en,
          explanation_fr: q.explanation_fr ?? "",
          explanation_en: q.explanation_en ?? "",
          difficulty,
          position,
          ai_generated: true,
        })
        .select()
        .single();

      await admin
        .from("choices")
        .insert(options.map((o, i) => ({ question_id: newQuestion.id, text_fr: o.text_fr, text_en: o.text_en, is_correct: o.is_correct, position: i })));

      await admin
        .from("content_approval")
        .update({ status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq("id", content_approval_id);

      await admin.from("admin_logs").insert({
        actor_id: user.id,
        action: "ai_question_approved",
        target_table: "questions",
        target_id: newQuestion.id,
        metadata: { content_approval_id, quiz_id: quizId },
      });

      if (submission.submitted_by && submission.submitted_by !== user.id) {
        await admin.from("notifications").insert({
          user_id: submission.submitted_by,
          type: "content_approved",
          title_fr: "Question approuvée",
          title_en: "Question approved",
          body_fr: q.text_fr.slice(0, 140),
          body_en: (q.text_en || q.text_fr).slice(0, 140),
        });
      }

      return jsonResponse({ ok: true, quizId, questionId: newQuestion.id });
    }

    return jsonResponse({ error: "unknown action" }, 400);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});

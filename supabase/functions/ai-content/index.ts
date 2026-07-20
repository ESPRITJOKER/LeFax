// ai-content — Moteur IA de génération de contenu (CDC 6.8 / section 10
// "Contenu IA: soumission document source, génération, statut validation")
//
// The only paid, externally-dependent piece of the MVP besides SMS (CDC
// section 8). `generate` calls the Anthropic API to turn a teacher's source
// document into draft QCM + explanations; `approve` performs the actual
// publish step (creating quiz/questions/choices) once an admin has approved
// a submission in content_approval — CDC 6.8's "aucun contenu généré n'est
// publié sans relecture/modification/approbation explicite enseignant [puis
// admin]" is enforced by this being the *only* path that writes into
// quizzes/questions/choices from AI output.
//
// ANTHROPIC_API_KEY is unset in this scaffold — `generate` will fail over
// the network until a real key is provided as an Edge Function secret.

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, getUserClientAndUser } from "../_shared/supabaseAdmin.ts";

declare const Deno: { env: { get(key: string): string | undefined } };

const ANTHROPIC_MODEL = "claude-sonnet-4-5";

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const { user, error: authError } = await getUserClientAndUser(req);
  if (authError || !user) return jsonResponse({ error: "unauthorized" }, 401);

  try {
    const body = await req.json();
    const admin = getServiceClient();

    if (body.action === "generate") {
      const { lesson_id, media_id } = body;
      if (!lesson_id) return jsonResponse({ error: "lesson_id is required" }, 400);

      const { data: lesson } = await admin.from("lessons").select("*").eq("id", lesson_id).maybeSingle();
      if (!lesson) return jsonResponse({ error: "lesson not found" }, 404);

      let sourceText = `${lesson.title_fr}\n\n${lesson.content_fr}`;
      if (media_id) {
        const { data: media } = await admin.from("media_library").select("*").eq("id", media_id).maybeSingle();
        // TODO: fetch the actual file bytes from Supabase Storage
        // (media.storage_path) and extract text (PDF/Word/slides parsing)
        // before sending to Claude. For the scaffold we fall back to the
        // lesson's own content as the source text.
        void media;
      }

      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!apiKey) {
        return jsonResponse(
          { error: "ANTHROPIC_API_KEY not configured — see .env.example and README for setup steps." },
          503
        );
      }

      const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 2048,
          messages: [
            {
              role: "user",
              content: `You are generating multiple-choice exam questions (QCM) for a Cameroonian medicine entrance exam prep app, bilingual French/English. Based on this lesson content, produce 5 questions as a JSON array. Each item: { "text_fr": string, "text_en": string, "explanation_fr": string, "explanation_en": string, "options": [{ "text_fr": string, "text_en": string, "is_correct": boolean }] } with exactly 4 options and exactly one is_correct=true.\n\nLesson content:\n${sourceText}`,
            },
          ],
        }),
      });

      if (!anthropicResponse.ok) {
        const errText = await anthropicResponse.text();
        return jsonResponse({ error: `Anthropic API error: ${errText}` }, 502);
      }

      const anthropicJson = await anthropicResponse.json();
      const textBlock = anthropicJson?.content?.[0]?.text ?? "[]";
      const questions = JSON.parse(textBlock);

      return jsonResponse({ questions });
    }

    if (body.action === "approve") {
      const { content_approval_id } = body;
      if (!content_approval_id) return jsonResponse({ error: "content_approval_id is required" }, 400);

      const { data: caller } = await admin.from("profiles").select("role").eq("id", user.id).single();
      if (!caller || !["admin", "super_admin"].includes(caller.role)) return jsonResponse({ error: "forbidden" }, 403);

      const { data: submission } = await admin.from("content_approval").select("*").eq("id", content_approval_id).maybeSingle();
      if (!submission || submission.status === "approved") return jsonResponse({ error: "not found or already approved" }, 404);

      const q = submission.generated_payload as {
        text_fr: string;
        text_en: string;
        explanation_fr?: string;
        explanation_en?: string;
        options: { text_fr: string; text_en: string; is_correct: boolean }[];
      };

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

      const { data: newQuestion } = await admin
        .from("questions")
        .insert({
          quiz_id: quizId,
          text_fr: q.text_fr,
          text_en: q.text_en,
          explanation_fr: q.explanation_fr ?? "",
          explanation_en: q.explanation_en ?? "",
          ai_generated: true,
        })
        .select()
        .single();

      await admin
        .from("choices")
        .insert(q.options.map((o, i) => ({ question_id: newQuestion.id, text_fr: o.text_fr, text_en: o.text_en, is_correct: o.is_correct, position: i })));

      await admin
        .from("content_approval")
        .update({ status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq("id", content_approval_id);

      return jsonResponse({ ok: true, quizId, questionId: newQuestion.id });
    }

    return jsonResponse({ error: "unknown action" }, 400);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});

import { z } from "zod";
import type { FastifyInstance } from "fastify";

/**
 * Teacher console (CDC §5). Content creation writes real rows to
 * lesson_cards/qcms/past_papers, but image/PDF fields are plain URL strings
 * rather than a Cloudflare R2 presigned-upload pipeline — no R2 credentials
 * are configured yet (same category of gap as SMS/CinetPay). A teacher can
 * still create real text-based content and submit it through the actual
 * review workflow end-to-end.
 */
export default async function teacherRoutes(fastify: FastifyInstance) {
  const guard = { onRequest: [fastify.authenticate, fastify.requireRole("teacher")] };

  fastify.get("/teacher/lessons-list", guard, async (_request, reply) => {
    // Lightweight lookup for the "attach to lesson" pickers below — creating
    // branches/subjects/chapters/lessons themselves isn't a Phase-1 teacher
    // module (WEB-T02 only covers attaching cards to an existing lesson).
    const { data, error } = await fastify.supabase
      .from("lessons")
      .select("id, title, chapters(name, subjects(name, branches(name)))")
      .order("title");
    if (error) throw error;
    return reply.send({ lessons: data ?? [] });
  });

  fastify.get("/teacher/content", guard, async (request, reply) => {
    const teacherId = request.user.sub;
    const [{ data: cards }, { data: qcms }, { data: papers }, { data: reviews }] = await Promise.all([
      fastify.supabase
        .from("lesson_cards")
        .select("id, card_type, text_content, is_published, created_at, lesson_id")
        .eq("created_by", teacherId),
      fastify.supabase.from("qcms").select("id, question, difficulty, is_published, created_at, lesson_id").eq("created_by", teacherId),
      fastify.supabase
        .from("past_papers")
        .select("id, title, year, is_published, created_at")
        .eq("created_by", teacherId),
      fastify.supabase
        .from("content_reviews")
        .select("content_type, content_id, status, feedback")
        .eq("submitted_by", teacherId),
    ]);

    const reviewByKey = new Map((reviews ?? []).map((r) => [`${r.content_type}:${r.content_id}`, r]));
    const withStatus = (type: string, rows: ({ id: string; is_published: boolean; created_at: string } & Record<string, unknown>)[] | null) =>
      (rows ?? []).map((row) => {
        const review = reviewByKey.get(`${type}:${row.id}`);
        const status = row.is_published ? "approved" : (review?.status ?? "draft");
        return { ...row, type, status, feedback: review?.feedback ?? null };
      });

    return reply.send({
      items: [
        ...withStatus("lesson_card", cards),
        ...withStatus("qcm", qcms),
        ...withStatus("past_paper", papers),
      ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    });
  });

  const createCardSchema = z.object({
    lessonId: z.string().uuid(),
    cardType: z.enum(["text", "image", "text_image", "table", "svg"]),
    textContent: z.string().optional(),
    imageUrl: z.string().url().optional(),
    imageAlt: z.string().optional(),
    orderIndex: z.number().int().default(0),
  });

  fastify.post<{ Body: unknown }>("/teacher/lesson-cards", guard, async (request, reply) => {
    const body = createCardSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "INVALID_BODY", message: body.error.issues[0]?.message });
    const { data, error } = await fastify.supabase
      .from("lesson_cards")
      .insert({
        lesson_id: body.data.lessonId,
        card_type: body.data.cardType,
        text_content: body.data.textContent,
        image_url: body.data.imageUrl,
        image_alt: body.data.imageAlt,
        order_index: body.data.orderIndex,
        created_by: request.user.sub,
      })
      .select("*")
      .single();
    if (error) throw error;
    return reply.send({ card: data });
  });

  const createQcmSchema = z.object({
    lessonId: z.string().uuid(),
    question: z.string().min(5),
    options: z.array(z.object({ id: z.string(), text: z.string().min(1) })).length(4),
    correctOptionId: z.string(),
    explanation: z.string().min(30),
    difficulty: z.enum(["easy", "intermediate", "hard"]),
  });

  fastify.post<{ Body: unknown }>("/teacher/qcms", guard, async (request, reply) => {
    const body = createQcmSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "INVALID_BODY", message: body.error.issues[0]?.message });
    if (!body.data.options.some((o) => o.id === body.data.correctOptionId)) {
      return reply.code(400).send({ error: "INVALID_BODY", message: "La bonne réponse doit correspondre à une option." });
    }
    const { data, error } = await fastify.supabase
      .from("qcms")
      .insert({
        lesson_id: body.data.lessonId,
        question: body.data.question,
        options: body.data.options,
        correct_option_id: body.data.correctOptionId,
        explanation: body.data.explanation,
        difficulty: body.data.difficulty,
        created_by: request.user.sub,
      })
      .select("*")
      .single();
    if (error) throw error;
    return reply.send({ qcm: data });
  });

  const createPaperSchema = z.object({
    branchId: z.string().uuid(),
    subjectId: z.string().uuid().optional(),
    title: z.string().min(3),
    schoolName: z.string().min(2),
    year: z.number().int().min(2000).max(2100),
    paperUrl: z.string().url(),
    correctionText: z.string().optional(),
    correctionUrl: z.string().url().optional(),
  });

  fastify.post<{ Body: unknown }>("/teacher/past-papers", guard, async (request, reply) => {
    const body = createPaperSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "INVALID_BODY", message: body.error.issues[0]?.message });
    if (!body.data.correctionText && !body.data.correctionUrl) {
      return reply.code(400).send({ error: "INVALID_BODY", message: "Une correction (texte ou PDF) est obligatoire." });
    }
    const { data, error } = await fastify.supabase
      .from("past_papers")
      .insert({
        branch_id: body.data.branchId,
        subject_id: body.data.subjectId,
        title: body.data.title,
        school_name: body.data.schoolName,
        year: body.data.year,
        paper_url: body.data.paperUrl,
        correction_text: body.data.correctionText,
        correction_url: body.data.correctionUrl,
        created_by: request.user.sub,
      })
      .select("*")
      .single();
    if (error) throw error;
    return reply.send({ paper: data });
  });

  fastify.post<{ Params: { contentType: string; contentId: string } }>(
    "/teacher/content/:contentType/:contentId/submit-review",
    guard,
    async (request, reply) => {
      const contentType = request.params.contentType;
      if (!["lesson_card", "qcm", "past_paper"].includes(contentType)) {
        return reply.code(400).send({ error: "INVALID_TYPE" });
      }
      const { data, error } = await fastify.supabase
        .from("content_reviews")
        .upsert(
          {
            content_type: contentType,
            content_id: request.params.contentId,
            submitted_by: request.user.sub,
            status: "in_review",
            submitted_at: new Date().toISOString(),
          },
          { onConflict: "content_type,content_id" }
        )
        .select("*")
        .single();
      if (error) throw error;
      return reply.send({ review: data });
    }
  );

  // --- Q&A inbox (WEB-T06) -------------------------------------------------
  fastify.get("/teacher/qa/questions", guard, async (request, reply) => {
    const status = (request.query as { status?: string }).status ?? "unanswered";
    const { data: questions, error } = await fastify.supabase
      .from("qa_questions")
      .select("id, title, body, created_at, student_id, lesson_id, branch_id, profiles(first_name)")
      .order("created_at", { ascending: true });
    if (error) throw error;

    const ids = (questions ?? []).map((q) => q.id);
    const { data: answers } = ids.length
      ? await fastify.supabase.from("qa_answers").select("question_id").in("question_id", ids)
      : { data: [] };
    const answeredIds = new Set((answers ?? []).map((a) => a.question_id));

    const filtered = (questions ?? []).filter((q) => (status === "answered" ? answeredIds.has(q.id) : !answeredIds.has(q.id)));
    return reply.send({ questions: filtered });
  });

  fastify.post<{ Params: { questionId: string }; Body: unknown }>(
    "/teacher/qa/questions/:questionId/answer",
    guard,
    async (request, reply) => {
      const body = z.object({ body: z.string().min(5) }).safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: "INVALID_BODY" });
      const { data, error } = await fastify.supabase
        .from("qa_answers")
        .insert({ question_id: request.params.questionId, teacher_id: request.user.sub, body: body.data.body })
        .select("*")
        .single();
      if (error) throw error;
      return reply.send({ answer: data });
    }
  );
}

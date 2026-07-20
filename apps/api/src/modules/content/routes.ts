import type { FastifyInstance } from "fastify";

/**
 * Read-only content hierarchy (CDC WEB-E04): branches -> subjects -> chapters
 * -> lessons -> cards. Only published rows are ever returned to students —
 * the is_published filter is the real authorization boundary here, same
 * shape as the RLS policies in 0001_init.sql.
 */
export default async function contentRoutes(fastify: FastifyInstance) {
  const guard = { onRequest: [fastify.authenticate, fastify.requireRole("student")] };

  fastify.get("/content/branches", { onRequest: [fastify.authenticate] }, async (_request, reply) => {
    const { data, error } = await fastify.supabase
      .from("branches")
      .select("id, slug, name, description, is_active, order_index")
      .order("order_index");
    if (error) throw error;
    return reply.send({ branches: data });
  });

  fastify.get<{ Params: { branchId: string } }>(
    "/content/branches/:branchId/subjects",
    guard,
    async (request, reply) => {
      const { data: subjects, error } = await fastify.supabase
        .from("subjects")
        .select("id, name, order_index")
        .eq("branch_id", request.params.branchId)
        .order("order_index");
      if (error) throw error;

      const subjectIds = (subjects ?? []).map((s) => s.id);
      const { data: chapters, error: chErr } = subjectIds.length
        ? await fastify.supabase.from("chapters").select("id, subject_id").in("subject_id", subjectIds)
        : { data: [], error: null };
      if (chErr) throw chErr;

      const chapterCountBySubject = new Map<string, number>();
      for (const c of chapters ?? []) {
        chapterCountBySubject.set(c.subject_id, (chapterCountBySubject.get(c.subject_id) ?? 0) + 1);
      }

      return reply.send({
        subjects: (subjects ?? []).map((s) => ({ ...s, chapterCount: chapterCountBySubject.get(s.id) ?? 0 })),
      });
    }
  );

  fastify.get<{ Params: { subjectId: string } }>(
    "/content/subjects/:subjectId/chapters",
    guard,
    async (request, reply) => {
      const { data, error } = await fastify.supabase
        .from("chapters")
        .select("id, name, order_index")
        .eq("subject_id", request.params.subjectId)
        .order("order_index");
      if (error) throw error;
      return reply.send({ chapters: data });
    }
  );

  fastify.get<{ Params: { chapterId: string } }>(
    "/content/chapters/:chapterId/lessons",
    guard,
    async (request, reply) => {
      const studentId = request.user.sub;
      const { data: lessons, error } = await fastify.supabase
        .from("lessons")
        .select("id, title, estimated_minutes, order_index")
        .eq("chapter_id", request.params.chapterId)
        .eq("is_published", true)
        .order("order_index");
      if (error) throw error;

      const lessonIds = (lessons ?? []).map((l) => l.id);
      const { data: progress, error: progErr } = lessonIds.length
        ? await fastify.supabase
            .from("student_progress")
            .select("lesson_id, cards_seen, cards_total, completed")
            .eq("student_id", studentId)
            .in("lesson_id", lessonIds)
        : { data: [], error: null };
      if (progErr) throw progErr;

      const progressByLesson = new Map((progress ?? []).map((p) => [p.lesson_id, p]));
      return reply.send({
        lessons: (lessons ?? []).map((l) => ({
          ...l,
          progress: progressByLesson.get(l.id) ?? { cards_seen: 0, cards_total: 0, completed: false },
        })),
      });
    }
  );

  fastify.get<{ Params: { lessonId: string } }>("/content/lessons/:lessonId", guard, async (request, reply) => {
    const { data: lesson, error } = await fastify.supabase
      .from("lessons")
      .select("id, title, estimated_minutes, chapter_id, chapters(name, subjects(name))")
      .eq("id", request.params.lessonId)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw error;
    if (!lesson) return reply.code(404).send({ error: "NOT_FOUND", message: "Leçon introuvable." });

    const { data: cards, error: cardsErr } = await fastify.supabase
      .from("lesson_cards")
      .select("id, card_type, text_content, image_url, image_alt, table_data, svg_content, order_index")
      .eq("lesson_id", lesson.id)
      .eq("is_published", true)
      .order("order_index");
    if (cardsErr) throw cardsErr;

    return reply.send({ lesson: { ...lesson, cards: cards ?? [] } });
  });

  fastify.post<{ Params: { lessonId: string } }>(
    "/content/lessons/:lessonId/card-seen",
    guard,
    async (request, reply) => {
      const studentId = request.user.sub;
      const lessonId = request.params.lessonId;

      const { count: cardsTotal } = await fastify.supabase
        .from("lesson_cards")
        .select("id", { count: "exact", head: true })
        .eq("lesson_id", lessonId)
        .eq("is_published", true);

      const { data: existing } = await fastify.supabase
        .from("student_progress")
        .select("*")
        .eq("student_id", studentId)
        .eq("lesson_id", lessonId)
        .maybeSingle();

      const cardsSeen = Math.min((existing?.cards_seen ?? 0) + 1, cardsTotal ?? 0);
      const completed = cardsTotal !== null && cardsSeen >= cardsTotal;
      const wasAlreadyCompleted = existing?.completed ?? false;

      const { data: updated, error } = await fastify.supabase
        .from("student_progress")
        .upsert(
          {
            student_id: studentId,
            lesson_id: lessonId,
            cards_seen: cardsSeen,
            cards_total: cardsTotal ?? 0,
            completed,
            completed_at: completed ? new Date().toISOString() : existing?.completed_at ?? null,
          },
          { onConflict: "student_id,lesson_id" }
        )
        .select("*")
        .single();
      if (error) throw error;

      let coinsAwarded = 0;
      if (completed && !wasAlreadyCompleted) {
        coinsAwarded = 5;
        await fastify.supabase
          .from("coin_ledger")
          .insert({ student_id: studentId, amount: 5, reason: "lesson_complete", reference_id: lessonId });
      }

      return reply.send({ progress: updated, coinsAwarded });
    }
  );
}

import { z } from "zod";
import type { FastifyInstance } from "fastify";

const askSchema = z.object({
  branchId: z.string().uuid(),
  lessonId: z.string().uuid().optional(),
  title: z.string().min(5),
  body: z.string().min(10),
});

/** Student side of the Q&A forum (WEB-E14). Teacher side lives in modules/teacher. */
export default async function qaRoutes(fastify: FastifyInstance) {
  const guard = { onRequest: [fastify.authenticate, fastify.requireRole("student")] };

  fastify.get("/qa/questions", guard, async (request, reply) => {
    const lessonId = (request.query as { lessonId?: string }).lessonId;
    let query = fastify.supabase
      .from("qa_questions")
      .select("id, title, body, created_at, lesson_id, branch_id, qa_answers(id, body, published_at, teacher_id, profiles(first_name))")
      .order("created_at", { ascending: false });
    if (lessonId) query = query.eq("lesson_id", lessonId);
    const { data, error } = await query;
    if (error) throw error;
    return reply.send({ questions: data ?? [] });
  });

  fastify.post<{ Body: unknown }>("/qa/questions", guard, async (request, reply) => {
    const body = askSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "INVALID_BODY", message: body.error.issues[0]?.message });
    const { data, error } = await fastify.supabase
      .from("qa_questions")
      .insert({
        student_id: request.user.sub,
        branch_id: body.data.branchId,
        lesson_id: body.data.lessonId,
        title: body.data.title,
        body: body.data.body,
      })
      .select("*")
      .single();
    if (error) throw error;
    return reply.send({ question: data });
  });
}

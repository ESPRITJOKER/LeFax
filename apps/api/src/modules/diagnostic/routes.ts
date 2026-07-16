import { z } from "zod";
import type { FastifyInstance } from "fastify";

const startSchema = z.object({ branchId: z.string().uuid() });
const answerSchema = z.object({ questionId: z.string().uuid(), selectedOptionId: z.string().min(1) });

const WEAK_ZONE_THRESHOLD = 50;

/**
 * Skill-diagnostic flow — not a CDC v1.0 module, added alongside the
 * matching Stitch designs (diagnostic_test_intro / diagnostic_question /
 * mastery_profile_results) and DB schema in 0001_init.sql.
 */
export default async function diagnosticRoutes(fastify: FastifyInstance) {
  const guard = { onRequest: [fastify.authenticate, fastify.requireRole("student")] };

  fastify.post<{ Body: unknown }>("/diagnostic/sessions", guard, async (request, reply) => {
    const body = startSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "INVALID_BODY" });

    const { data: session, error } = await fastify.supabase
      .from("diagnostic_sessions")
      .insert({ student_id: request.user.sub, branch_id: body.data.branchId })
      .select("*")
      .single();
    if (error) throw error;

    const { data: questions, error: qErr } = await fastify.supabase
      .from("diagnostic_questions")
      .select("id, question, options, subject_id, order_index")
      .eq("branch_id", body.data.branchId)
      .order("order_index");
    if (qErr) throw qErr;

    return reply.send({ session, questions: questions ?? [] });
  });

  fastify.post<{ Params: { sessionId: string }; Body: unknown }>(
    "/diagnostic/sessions/:sessionId/responses",
    guard,
    async (request, reply) => {
      const body = answerSchema.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: "INVALID_BODY" });

      const { data: session } = await fastify.supabase
        .from("diagnostic_sessions")
        .select("id, student_id")
        .eq("id", request.params.sessionId)
        .eq("student_id", request.user.sub)
        .maybeSingle();
      if (!session) return reply.code(404).send({ error: "NOT_FOUND" });

      const { data: question } = await fastify.supabase
        .from("diagnostic_questions")
        .select("correct_option_id")
        .eq("id", body.data.questionId)
        .maybeSingle();
      if (!question) return reply.code(404).send({ error: "NOT_FOUND" });

      const isCorrect = body.data.selectedOptionId === question.correct_option_id;
      const { error } = await fastify.supabase.from("diagnostic_responses").insert({
        session_id: request.params.sessionId,
        question_id: body.data.questionId,
        selected_option_id: body.data.selectedOptionId,
        is_correct: isCorrect,
      });
      if (error) throw error;

      return reply.send({ isCorrect });
    }
  );

  fastify.post<{ Params: { sessionId: string } }>(
    "/diagnostic/sessions/:sessionId/complete",
    guard,
    async (request, reply) => {
      const { data: session } = await fastify.supabase
        .from("diagnostic_sessions")
        .select("id, student_id, branch_id")
        .eq("id", request.params.sessionId)
        .eq("student_id", request.user.sub)
        .maybeSingle();
      if (!session) return reply.code(404).send({ error: "NOT_FOUND" });

      const { data: responses } = await fastify.supabase
        .from("diagnostic_responses")
        .select("is_correct, diagnostic_questions(subject_id)")
        .eq("session_id", session.id);

      type ResponseRow = { is_correct: boolean; diagnostic_questions: { subject_id: string } | { subject_id: string }[] | null };
      const bySubject = new Map<string, { correct: number; total: number }>();
      for (const r of (responses as ResponseRow[] | null) ?? []) {
        const dq = Array.isArray(r.diagnostic_questions) ? r.diagnostic_questions[0] : r.diagnostic_questions;
        const subjectId = dq?.subject_id;
        if (!subjectId) continue;
        const stats = bySubject.get(subjectId) ?? { correct: 0, total: 0 };
        stats.total += 1;
        if (r.is_correct) stats.correct += 1;
        bySubject.set(subjectId, stats);
      }

      const profiles = [];
      for (const [subjectId, stats] of bySubject) {
        const score = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
        const { data: profile, error } = await fastify.supabase
          .from("mastery_profiles")
          .upsert(
            {
              student_id: session.student_id,
              branch_id: session.branch_id,
              subject_id: subjectId,
              mastery_score: score,
              is_weak_zone: score < WEAK_ZONE_THRESHOLD,
              computed_at: new Date().toISOString(),
            },
            { onConflict: "student_id,subject_id" }
          )
          .select("*")
          .single();
        if (error) throw error;
        profiles.push(profile);
      }

      await fastify.supabase
        .from("diagnostic_sessions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", session.id);

      return reply.send({ profiles });
    }
  );

  fastify.get<{ Params: { branchId: string } }>(
    "/diagnostic/branches/:branchId/mastery",
    guard,
    async (request, reply) => {
      const { data, error } = await fastify.supabase
        .from("mastery_profiles")
        .select("subject_id, mastery_score, is_weak_zone, computed_at, subjects(name)")
        .eq("student_id", request.user.sub)
        .eq("branch_id", request.params.branchId);
      if (error) throw error;
      return reply.send({ profiles: data ?? [] });
    }
  );
}

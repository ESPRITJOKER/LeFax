import { z } from "zod";
import type { FastifyInstance } from "fastify";

const DIFFICULTIES = ["easy", "intermediate", "hard"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];
const UNLOCK_THRESHOLD = 0.6;

const attemptSchema = z.object({ selectedOptionId: z.string().min(1) });

/**
 * QCM practice (WEB-E06). Difficulty gating is enforced server-side (S-03):
 * intermediate unlocks at >=60% correct in easy for this lesson, hard at
 * >=60% in intermediate. correct_option_id/explanation are never sent until
 * the student has actually attempted a question.
 */
export default async function exercisesRoutes(fastify: FastifyInstance) {
  const guard = { onRequest: [fastify.authenticate, fastify.requireRole("student")] };

  async function unlockedDifficulties(studentId: string, lessonId: string): Promise<Set<Difficulty>> {
    const unlocked = new Set<Difficulty>(["easy"]);
    const { data: qcms } = await fastify.supabase
      .from("qcms")
      .select("id, difficulty")
      .eq("lesson_id", lessonId)
      .eq("is_published", true);
    const idsByDifficulty = new Map<Difficulty, string[]>();
    for (const q of qcms ?? []) {
      const list = idsByDifficulty.get(q.difficulty as Difficulty) ?? [];
      list.push(q.id);
      idsByDifficulty.set(q.difficulty as Difficulty, list);
    }

    async function passRate(ids: string[]): Promise<number> {
      if (ids.length === 0) return 0;
      const { data: attempts } = await fastify.supabase
        .from("qcm_attempts")
        .select("qcm_id, is_correct")
        .eq("student_id", studentId)
        .in("qcm_id", ids);
      if (!attempts || attempts.length === 0) return 0;
      const correct = attempts.filter((a) => a.is_correct).length;
      return correct / attempts.length;
    }

    if ((await passRate(idsByDifficulty.get("easy") ?? [])) >= UNLOCK_THRESHOLD) {
      unlocked.add("intermediate");
      if ((await passRate(idsByDifficulty.get("intermediate") ?? [])) >= UNLOCK_THRESHOLD) {
        unlocked.add("hard");
      }
    }
    return unlocked;
  }

  fastify.get<{ Params: { lessonId: string } }>(
    "/exercises/lessons/:lessonId/qcms",
    guard,
    async (request, reply) => {
      const studentId = request.user.sub;
      const unlocked = await unlockedDifficulties(studentId, request.params.lessonId);

      const { data: qcms, error } = await fastify.supabase
        .from("qcms")
        .select("id, question, options, difficulty")
        .eq("lesson_id", request.params.lessonId)
        .eq("is_published", true)
        .order("created_at");
      if (error) throw error;

      return reply.send({
        unlockedDifficulties: Array.from(unlocked),
        qcms: qcms ?? [],
      });
    }
  );

  fastify.post<{ Params: { qcmId: string }; Body: unknown }>(
    "/exercises/qcms/:qcmId/attempt",
    guard,
    async (request, reply) => {
      const body = attemptSchema.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: "INVALID_BODY" });

      const { data: qcm, error } = await fastify.supabase
        .from("qcms")
        .select("id, lesson_id, correct_option_id, explanation, difficulty")
        .eq("id", request.params.qcmId)
        .eq("is_published", true)
        .maybeSingle();
      if (error) throw error;
      if (!qcm) return reply.code(404).send({ error: "NOT_FOUND" });

      const unlocked = await unlockedDifficulties(request.user.sub, qcm.lesson_id);
      if (!unlocked.has(qcm.difficulty as Difficulty)) {
        return reply.code(403).send({ error: "FORBIDDEN", message: "Ce niveau de difficulté n'est pas encore débloqué." });
      }

      const isCorrect = body.data.selectedOptionId === qcm.correct_option_id;
      const { error: insertError } = await fastify.supabase.from("qcm_attempts").insert({
        student_id: request.user.sub,
        qcm_id: qcm.id,
        selected_option_id: body.data.selectedOptionId,
        is_correct: isCorrect,
      });
      if (insertError) throw insertError;

      // 100% on the whole lesson awards coins once (checked on every attempt, cheap given lesson QCM counts are small).
      let coinsAwarded = 0;
      const { data: lessonQcms } = await fastify.supabase
        .from("qcms")
        .select("id")
        .eq("lesson_id", qcm.lesson_id)
        .eq("is_published", true);
      const lessonQcmIds = (lessonQcms ?? []).map((q) => q.id);
      if (lessonQcmIds.length > 0) {
        const { data: allAttempts } = await fastify.supabase
          .from("qcm_attempts")
          .select("qcm_id, is_correct")
          .eq("student_id", request.user.sub)
          .in("qcm_id", lessonQcmIds);
        const latestByQcm = new Map<string, boolean>();
        for (const a of allAttempts ?? []) latestByQcm.set(a.qcm_id, a.is_correct);
        const allCorrect = lessonQcmIds.every((id) => latestByQcm.get(id) === true);
        if (allCorrect && lessonQcmIds.every((id) => latestByQcm.has(id))) {
          const { count: alreadyAwarded } = await fastify.supabase
            .from("coin_ledger")
            .select("id", { count: "exact", head: true })
            .eq("student_id", request.user.sub)
            .eq("reason", "lesson_perfect_qcm")
            .eq("reference_id", qcm.lesson_id);
          if (!alreadyAwarded) {
            coinsAwarded = 10;
            await fastify.supabase
              .from("coin_ledger")
              .insert({ student_id: request.user.sub, amount: 10, reason: "lesson_perfect_qcm", reference_id: qcm.lesson_id });
          }
        }
      }

      return reply.send({
        isCorrect,
        correctOptionId: qcm.correct_option_id,
        explanation: qcm.explanation,
        coinsAwarded,
      });
    }
  );

  fastify.get("/exercises/bookmarks", guard, async (request, reply) => {
    const { data, error } = await fastify.supabase
      .from("bookmarks")
      .select("id, created_at, qcms(id, question, difficulty, lesson_id)")
      .eq("student_id", request.user.sub)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return reply.send({ bookmarks: data });
  });

  fastify.post<{ Body: unknown }>("/exercises/bookmarks", guard, async (request, reply) => {
    const body = z.object({ qcmId: z.string().uuid() }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "INVALID_BODY" });
    const { error } = await fastify.supabase
      .from("bookmarks")
      .upsert({ student_id: request.user.sub, qcm_id: body.data.qcmId }, { onConflict: "student_id,qcm_id" });
    if (error) throw error;
    return reply.send({ success: true });
  });

  fastify.delete<{ Params: { qcmId: string } }>("/exercises/bookmarks/:qcmId", guard, async (request, reply) => {
    const { error } = await fastify.supabase
      .from("bookmarks")
      .delete()
      .eq("student_id", request.user.sub)
      .eq("qcm_id", request.params.qcmId);
    if (error) throw error;
    return reply.send({ success: true });
  });
}

import { z } from "zod";
import type { FastifyInstance } from "fastify";

const submitSchema = z.object({ answers: z.record(z.string(), z.string()) });

/**
 * Mock exams (WEB-E09/E10). questions on mock_exams is a snapshot array of
 * qcm ids selected by an admin. Scoring happens synchronously on submit —
 * there's no Redis/BullMQ deployed yet (CDC NFR-09 calls for async scoring
 * at higher concurrency; deferred until that infra exists), so rank is
 * computed live from current standings rather than persisted.
 */
export default async function examsRoutes(fastify: FastifyInstance) {
  const guard = { onRequest: [fastify.authenticate, fastify.requireRole("student")] };

  fastify.get("/exams", guard, async (request, reply) => {
    const { data: profile } = await fastify.supabase
      .from("profiles")
      .select("branch_preferences")
      .eq("id", request.user.sub)
      .single();
    const branchSlugs: string[] = profile?.branch_preferences ?? [];

    const { data: branches } = branchSlugs.length
      ? await fastify.supabase.from("branches").select("id").in("slug", branchSlugs)
      : { data: [] };
    const branchIds = (branches ?? []).map((b) => b.id);

    const { data: exams, error } = branchIds.length
      ? await fastify.supabase
          .from("mock_exams")
          .select("id, title, opens_at, closes_at, duration_seconds, status, branch_id")
          .in("branch_id", branchIds)
          .order("opens_at", { ascending: false })
      : { data: [], error: null };
    if (error) throw error;

    return reply.send({ exams: exams ?? [] });
  });

  fastify.get<{ Params: { examId: string } }>("/exams/:examId", guard, async (request, reply) => {
    const { data: exam, error } = await fastify.supabase
      .from("mock_exams")
      .select("id, title, opens_at, closes_at, duration_seconds, status, questions")
      .eq("id", request.params.examId)
      .maybeSingle();
    if (error) throw error;
    if (!exam) return reply.code(404).send({ error: "NOT_FOUND" });

    const { data: submission } = await fastify.supabase
      .from("exam_submissions")
      .select("submitted_at, score")
      .eq("exam_id", exam.id)
      .eq("student_id", request.user.sub)
      .maybeSingle();

    const qcmIds: string[] = Array.isArray(exam.questions) ? exam.questions : [];
    const now = Date.now();
    const opensAt = new Date(exam.opens_at).getTime();
    const closesAt = new Date(exam.closes_at).getTime();
    const isOpen = now >= opensAt && now <= closesAt;

    // Only reveal questions once the exam window has actually opened, and
    // never leak correct_option_id/explanation before submission (S-04-style).
    let questions: unknown[] = [];
    if (isOpen && qcmIds.length && !submission) {
      const { data } = await fastify.supabase.from("qcms").select("id, question, options").in("id", qcmIds);
      questions = data ?? [];
    }

    return reply.send({
      exam: { ...exam, questions, questionCount: qcmIds.length },
      isOpen,
      submission: submission ?? null,
    });
  });

  fastify.post<{ Params: { examId: string } }>("/exams/:examId/start", guard, async (request, reply) => {
    const studentId = request.user.sub;
    const { data: exam, error } = await fastify.supabase
      .from("mock_exams")
      .select("opens_at, closes_at")
      .eq("id", request.params.examId)
      .maybeSingle();
    if (error) throw error;
    if (!exam) return reply.code(404).send({ error: "NOT_FOUND" });

    const now = Date.now();
    if (now < new Date(exam.opens_at).getTime() || now > new Date(exam.closes_at).getTime()) {
      return reply.code(403).send({ error: "EXAM_NOT_OPEN", message: "Le concours n'est pas ouvert actuellement." });
    }

    const fingerprint = request.headers["user-agent"] ?? "unknown";
    await fastify.supabase.from("exam_device_logs").insert({
      exam_id: request.params.examId,
      student_id: studentId,
      device_fingerprint: String(fingerprint).slice(0, 255),
      ip_address: request.ip,
    });

    const { data: submission, error: upsertError } = await fastify.supabase
      .from("exam_submissions")
      .upsert(
        { exam_id: request.params.examId, student_id: studentId, answers: {} },
        { onConflict: "exam_id,student_id", ignoreDuplicates: true }
      )
      .select("*")
      .single();
    if (upsertError) throw upsertError;

    return reply.send({ submission });
  });

  fastify.post<{ Params: { examId: string }; Body: unknown }>(
    "/exams/:examId/submit",
    guard,
    async (request, reply) => {
      const body = submitSchema.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: "INVALID_BODY" });

      const studentId = request.user.sub;
      const { data: exam, error } = await fastify.supabase
        .from("mock_exams")
        .select("opens_at, duration_seconds, questions")
        .eq("id", request.params.examId)
        .maybeSingle();
      if (error) throw error;
      if (!exam) return reply.code(404).send({ error: "NOT_FOUND" });

      // Server clock is the only source of truth for the deadline (NFR-08).
      const deadline = new Date(exam.opens_at).getTime() + exam.duration_seconds * 1000;
      const isLate = Date.now() > deadline + 5000;
      if (isLate) {
        return reply.code(422).send({ error: "SUBMISSION_EXPIRED", message: "Le délai de soumission est dépassé." });
      }

      const qcmIds: string[] = Array.isArray(exam.questions) ? exam.questions : [];
      const { data: qcms } = qcmIds.length
        ? await fastify.supabase.from("qcms").select("id, correct_option_id").in("id", qcmIds)
        : { data: [] };
      const correctById = new Map((qcms ?? []).map((q) => [q.id, q.correct_option_id]));
      const answers = body.data.answers;
      const correctCount = qcmIds.filter((id) => answers[id] === correctById.get(id)).length;
      const score = qcmIds.length ? Math.round((correctCount / qcmIds.length) * 100) : 0;

      const { data: submission, error: updateError } = await fastify.supabase
        .from("exam_submissions")
        .upsert(
          {
            exam_id: request.params.examId,
            student_id: studentId,
            answers,
            submitted_at: new Date().toISOString(),
            score,
            is_late: false,
          },
          { onConflict: "exam_id,student_id" }
        )
        .select("*")
        .single();
      if (updateError) throw updateError;

      const { data: allScored } = await fastify.supabase
        .from("exam_submissions")
        .select("student_id, score")
        .eq("exam_id", request.params.examId)
        .not("score", "is", null)
        .order("score", { ascending: false });
      const rank = (allScored ?? []).findIndex((s) => s.student_id === studentId) + 1;

      const alreadyAwarded = await fastify.supabase
        .from("coin_ledger")
        .select("id", { count: "exact", head: true })
        .eq("student_id", studentId)
        .eq("reason", "exam_participation")
        .eq("reference_id", request.params.examId);
      let coinsAwarded = 0;
      if (!alreadyAwarded.count) {
        coinsAwarded = 15;
        await fastify.supabase
          .from("coin_ledger")
          .insert({ student_id: studentId, amount: 15, reason: "exam_participation", reference_id: request.params.examId });
        if (rank > 0 && rank <= 10) {
          coinsAwarded += 30;
          await fastify.supabase
            .from("coin_ledger")
            .insert({ student_id: studentId, amount: 30, reason: "exam_top10", reference_id: request.params.examId });
        }
      }

      return reply.send({ submission, rank, coinsAwarded });
    }
  );

  fastify.get<{ Params: { examId: string } }>("/exams/:examId/leaderboard", guard, async (request, reply) => {
    const { data: submissions, error } = await fastify.supabase
      .from("exam_submissions")
      .select("student_id, score, submitted_at, profiles(first_name)")
      .eq("exam_id", request.params.examId)
      .not("score", "is", null)
      .order("score", { ascending: false })
      .order("submitted_at", { ascending: true });
    if (error) throw error;

    type SubmissionRow = {
      student_id: string;
      score: number | null;
      submitted_at: string;
      profiles: { first_name: string | null } | { first_name: string | null }[] | null;
    };
    const leaderboard = (submissions as SubmissionRow[] | null ?? []).map((s, i) => {
      const profile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
      return {
        rank: i + 1,
        studentId: s.student_id,
        firstName: profile?.first_name ?? "Anonyme",
        score: s.score,
        isMe: s.student_id === request.user.sub,
      };
    });

    return reply.send({ leaderboard });
  });

  /** WEB-E10 "Résultats détaillés" — question-by-question review, only once the student has actually submitted. */
  fastify.get<{ Params: { examId: string } }>("/exams/:examId/corrections", guard, async (request, reply) => {
    const { data: submission } = await fastify.supabase
      .from("exam_submissions")
      .select("answers, score, submitted_at")
      .eq("exam_id", request.params.examId)
      .eq("student_id", request.user.sub)
      .maybeSingle();
    if (!submission || !submission.submitted_at) {
      return reply.code(403).send({ error: "FORBIDDEN", message: "Vous n'avez pas encore soumis ce concours." });
    }

    const { data: exam } = await fastify.supabase.from("mock_exams").select("questions").eq("id", request.params.examId).maybeSingle();
    const qcmIds: string[] = Array.isArray(exam?.questions) ? exam.questions : [];
    const { data: qcms } = qcmIds.length
      ? await fastify.supabase.from("qcms").select("id, question, options, correct_option_id, explanation").in("id", qcmIds)
      : { data: [] };
    const qcmById = new Map((qcms ?? []).map((q) => [q.id, q]));
    const answers = (submission.answers as Record<string, string>) ?? {};

    const corrections = qcmIds
      .map((id) => qcmById.get(id))
      .filter((q): q is NonNullable<typeof q> => Boolean(q))
      .map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        correctOptionId: q.correct_option_id,
        explanation: q.explanation,
        studentAnswerId: answers[q.id] ?? null,
      }));

    return reply.send({ score: submission.score, corrections });
  });
}

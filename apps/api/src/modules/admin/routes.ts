import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { FastifyInstance } from "fastify";

const ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

function generateAccessCode(): string {
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => ACCESS_CODE_ALPHABET[b % ACCESS_CODE_ALPHABET.length]).join("");
}

async function logAdminAction(
  fastify: FastifyInstance,
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>
) {
  await fastify.supabase
    .from("admin_action_logs")
    .insert({ admin_id: adminId, action, target_type: targetType, target_id: targetId, metadata: metadata ?? {} });
}

/**
 * Admin console (CDC §6). Every action here is logged to admin_action_logs
 * (NFR-12, S-12). Two Phase-1-scoped areas are intentionally NOT built as
 * write endpoints yet, and say so via TODO rather than faking them:
 *  - Teacher/admin invitations (WEB-A04): needs a new `invitations` table
 *    (token + 72h expiry) that doesn't exist in 0001_init.sql yet, plus an
 *    email provider (same category of external dependency as Africa's
 *    Talking for SMS — nothing to wire against right now).
 *  - Payment reconciliation actions (WEB-A06): no CinetPay account/webhook
 *    configured yet, so this is read-only (an honestly empty journal).
 */
export default async function adminRoutes(fastify: FastifyInstance) {
  const guard = { onRequest: [fastify.authenticate, fastify.requireRole("admin")] };

  // --- Metrics (WEB-A01, minimal) -----------------------------------------
  fastify.get("/admin/metrics", guard, async (_request, reply) => {
    const [{ count: totalStudents }, { count: totalTeachers }, { count: pendingReviews }, { count: publishedLessons }, { count: publishedQcms }, { count: activeSubscriptions }] =
      await Promise.all([
        fastify.supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
        fastify.supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "teacher"),
        fastify.supabase.from("content_reviews").select("id", { count: "exact", head: true }).eq("status", "in_review"),
        fastify.supabase.from("lessons").select("id", { count: "exact", head: true }).eq("is_published", true),
        fastify.supabase.from("qcms").select("id", { count: "exact", head: true }).eq("is_published", true),
        fastify.supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);

    return reply.send({
      totalStudents: totalStudents ?? 0,
      totalTeachers: totalTeachers ?? 0,
      pendingReviews: pendingReviews ?? 0,
      publishedLessons: publishedLessons ?? 0,
      publishedQcms: publishedQcms ?? 0,
      activeSubscriptions: activeSubscriptions ?? 0,
    });
  });

  // --- Review queue (WEB-A02) ---------------------------------------------
  fastify.get("/admin/reviews", guard, async (request, reply) => {
    const status = (request.query as { status?: string }).status ?? "in_review";
    const { data, error } = await fastify.supabase
      .from("content_reviews")
      .select(
        "id, content_type, content_id, submitted_by, status, feedback, submitted_at, profiles!content_reviews_submitted_by_fkey(first_name, email)"
      )
      .eq("status", status)
      .order("submitted_at", { ascending: true });
    if (error) throw error;
    return reply.send({ reviews: data ?? [] });
  });

  const CONTENT_TABLE: Record<string, string> = { lesson_card: "lesson_cards", qcm: "qcms", past_paper: "past_papers" };

  fastify.post<{ Params: { reviewId: string } }>("/admin/reviews/:reviewId/approve", guard, async (request, reply) => {
    const { data: review } = await fastify.supabase
      .from("content_reviews")
      .select("*")
      .eq("id", request.params.reviewId)
      .maybeSingle();
    if (!review) return reply.code(404).send({ error: "NOT_FOUND" });

    const table = CONTENT_TABLE[review.content_type];
    if (!table) return reply.code(400).send({ error: "INVALID_TYPE" });
    const { error: publishError } = await fastify.supabase.from(table).update({ is_published: true }).eq("id", review.content_id);
    if (publishError) throw publishError;

    const { error } = await fastify.supabase
      .from("content_reviews")
      .update({ status: "approved", reviewed_by: request.user.sub, reviewed_at: new Date().toISOString() })
      .eq("id", review.id);
    if (error) throw error;

    await logAdminAction(fastify, request.user.sub, "approve_content", review.content_type, review.content_id);
    return reply.send({ success: true });
  });

  fastify.post<{ Params: { reviewId: string }; Body: unknown }>(
    "/admin/reviews/:reviewId/reject",
    guard,
    async (request, reply) => {
      const body = z.object({ feedback: z.string().min(20) }).safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: "INVALID_BODY", message: "Feedback requis (min 20 caractères)." });

      const { data: review } = await fastify.supabase
        .from("content_reviews")
        .select("*")
        .eq("id", request.params.reviewId)
        .maybeSingle();
      if (!review) return reply.code(404).send({ error: "NOT_FOUND" });

      const { error } = await fastify.supabase
        .from("content_reviews")
        .update({
          status: "rejected",
          feedback: body.data.feedback,
          reviewed_by: request.user.sub,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", review.id);
      if (error) throw error;

      await logAdminAction(fastify, request.user.sub, "reject_content", review.content_type, review.content_id, {
        feedback: body.data.feedback,
      });
      return reply.send({ success: true });
    }
  );

  // --- Users (WEB-A04, minus invitations) ---------------------------------
  fastify.get("/admin/users", guard, async (request, reply) => {
    const { role, search } = request.query as { role?: string; search?: string };
    let query = fastify.supabase
      .from("profiles")
      .select("id, role, phone, email, first_name, is_active, created_at, branch_preferences")
      .order("created_at", { ascending: false })
      .limit(50);
    if (role) query = query.eq("role", role);
    if (search) query = query.or(`first_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) throw error;
    return reply.send({ users: data ?? [] });
  });

  fastify.post<{ Params: { userId: string } }>("/admin/users/:userId/deactivate", guard, async (request, reply) => {
    const { error } = await fastify.supabase.from("profiles").update({ is_active: false }).eq("id", request.params.userId);
    if (error) throw error;
    await logAdminAction(fastify, request.user.sub, "deactivate_user", "profile", request.params.userId);
    return reply.send({ success: true });
  });

  fastify.post<{ Params: { userId: string }; Body: unknown }>(
    "/admin/users/:userId/role",
    guard,
    async (request, reply) => {
      const body = z.object({ role: z.enum(["student", "teacher", "admin"]) }).safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: "INVALID_BODY" });
      const { error } = await fastify.supabase.from("profiles").update({ role: body.data.role }).eq("id", request.params.userId);
      if (error) throw error;
      await logAdminAction(fastify, request.user.sub, "change_role", "profile", request.params.userId, { role: body.data.role });
      return reply.send({ success: true });
    }
  );

  // --- Schools / B2B (WEB-A05) --------------------------------------------
  fastify.get("/admin/schools", guard, async (_request, reply) => {
    const { data, error } = await fastify.supabase
      .from("schools")
      .select("*, branches(name)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return reply.send({ schools: data ?? [] });
  });

  const createSchoolSchema = z.object({
    name: z.string().min(2),
    city: z.string().optional(),
    branchId: z.string().uuid(),
    seatQuota: z.number().int().positive(),
    contractExpiresAt: z.string(),
    directorEmail: z.string().email().optional(),
  });

  fastify.post<{ Body: unknown }>("/admin/schools", guard, async (request, reply) => {
    const body = createSchoolSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "INVALID_BODY", message: body.error.issues[0]?.message });

    const { data, error } = await fastify.supabase
      .from("schools")
      .insert({
        name: body.data.name,
        city: body.data.city,
        branch_id: body.data.branchId,
        access_code: generateAccessCode(),
        seat_quota: body.data.seatQuota,
        contract_expires_at: body.data.contractExpiresAt,
        director_email: body.data.directorEmail,
      })
      .select("*")
      .single();
    if (error) throw error;

    await logAdminAction(fastify, request.user.sub, "create_school", "school", data.id);
    return reply.send({ school: data });
  });

  fastify.post<{ Params: { schoolId: string } }>("/admin/schools/:schoolId/regenerate-code", guard, async (request, reply) => {
    const { data, error } = await fastify.supabase
      .from("schools")
      .update({ access_code: generateAccessCode() })
      .eq("id", request.params.schoolId)
      .select("*")
      .single();
    if (error) throw error;
    await logAdminAction(fastify, request.user.sub, "regenerate_school_code", "school", request.params.schoolId);
    return reply.send({ school: data });
  });

  // --- QCM picker for exam creation ---------------------------------------
  fastify.get("/admin/qcms", guard, async (_request, reply) => {
    const { data, error } = await fastify.supabase
      .from("qcms")
      .select("id, question, difficulty, lessons(title)")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return reply.send({ qcms: data ?? [] });
  });

  // --- Mock exams (WEB-A03, minus BullMQ-scheduled push notifications) ---
  fastify.get("/admin/exams", guard, async (_request, reply) => {
    const { data, error } = await fastify.supabase
      .from("mock_exams")
      .select("id, title, branch_id, opens_at, closes_at, duration_seconds, status, questions, branches(name)")
      .order("opens_at", { ascending: false });
    if (error) throw error;
    return reply.send({
      exams: (data ?? []).map((e) => ({ ...e, questionCount: Array.isArray(e.questions) ? e.questions.length : 0 })),
    });
  });

  const createExamSchema = z.object({
    title: z.string().min(3),
    branchId: z.string().uuid(),
    opensAt: z.string(),
    durationSeconds: z.number().int().positive(),
    qcmIds: z.array(z.string().uuid()).min(10, "Minimum 10 questions requises."),
  });

  fastify.post<{ Body: unknown }>("/admin/exams", guard, async (request, reply) => {
    const body = createExamSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "INVALID_BODY", message: body.error.issues[0]?.message });
    if (new Date(body.data.opensAt).getTime() <= Date.now()) {
      return reply.code(400).send({ error: "INVALID_BODY", message: "La date d'ouverture doit être dans le futur." });
    }

    const closesAt = new Date(new Date(body.data.opensAt).getTime() + body.data.durationSeconds * 1000).toISOString();
    const { data, error } = await fastify.supabase
      .from("mock_exams")
      .insert({
        title: body.data.title,
        branch_id: body.data.branchId,
        opens_at: body.data.opensAt,
        closes_at: closesAt,
        duration_seconds: body.data.durationSeconds,
        questions: body.data.qcmIds,
        status: "scheduled",
        created_by: request.user.sub,
      })
      .select("*")
      .single();
    if (error) throw error;

    await logAdminAction(fastify, request.user.sub, "create_exam", "mock_exam", data.id);
    return reply.send({ exam: data });
  });

  // --- Payments (WEB-A06, read-only until CinetPay is connected) ---------
  fastify.get("/admin/payments", guard, async (_request, reply) => {
    const { data, error } = await fastify.supabase
      .from("payments")
      .select("id, student_id, cinetpay_transaction_id, amount_xaf, status, confirmed_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return reply.send({ payments: data ?? [] });
  });
}

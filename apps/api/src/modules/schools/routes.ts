import { z } from "zod";
import type { FastifyInstance } from "fastify";

const codeSchema = z.object({ code: z.string().trim().min(1).max(16) });

type SchoolRow = {
  id: string;
  name: string;
  seat_quota: number;
  seats_used: number;
  contract_expires_at: string;
  is_active: boolean;
  branches: { slug: string; name: string } | { slug: string; name: string }[] | null;
};

function normalizeBranch(branches: SchoolRow["branches"]) {
  return Array.isArray(branches) ? branches[0] : branches;
}

async function findValidSchool(fastify: FastifyInstance, code: string) {
  const { data, error } = await fastify.supabase
    .from("schools")
    .select("id, name, seat_quota, seats_used, contract_expires_at, is_active, branches(slug, name)")
    .eq("access_code", code.toUpperCase())
    .maybeSingle<SchoolRow>();
  if (error) throw error;
  if (!data || !data.is_active) return null;
  if (new Date(data.contract_expires_at).getTime() < Date.now()) return null;
  return data;
}

/**
 * Student side of B2B school codes (WEB-E01 signup step / WEB-E15 profile).
 * validate-code is intentionally public: it runs during signup, before the
 * student has an access token.
 */
export default async function schoolsRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: unknown }>("/schools/validate-code", async (request, reply) => {
    const body = codeSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "INVALID_BODY" });

    const school = await findValidSchool(fastify, body.data.code);
    if (!school) return reply.send({ valid: false });
    if (school.seats_used >= school.seat_quota) return reply.send({ valid: false, reason: "FULL" });

    const branch = normalizeBranch(school.branches);
    return reply.send({ valid: true, schoolName: school.name, branchName: branch?.name ?? null });
  });

  fastify.post<{ Body: unknown }>(
    "/schools/join",
    { onRequest: [fastify.authenticate, fastify.requireRole("student")] },
    async (request, reply) => {
      const body = codeSchema.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: "INVALID_BODY" });

      const school = await findValidSchool(fastify, body.data.code);
      if (!school) return reply.code(404).send({ error: "SCHOOL_CODE_INVALID", message: "Code établissement invalide ou expiré." });
      if (school.seats_used >= school.seat_quota) {
        return reply.code(422).send({ error: "SCHOOL_FULL", message: "Ce code a atteint son quota de places." });
      }

      const { data: existing } = await fastify.supabase
        .from("school_students")
        .select("school_id")
        .eq("school_id", school.id)
        .eq("student_id", request.user.sub)
        .maybeSingle();
      if (existing) return reply.send({ joined: true, schoolName: school.name });

      const { error: insertError } = await fastify.supabase
        .from("school_students")
        .insert({ school_id: school.id, student_id: request.user.sub });
      if (insertError) throw insertError;

      await fastify.supabase
        .from("schools")
        .update({ seats_used: school.seats_used + 1 })
        .eq("id", school.id);

      return reply.send({ joined: true, schoolName: school.name });
    }
  );
}

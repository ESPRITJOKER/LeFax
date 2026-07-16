import type { FastifyInstance } from "fastify";

/** Anciens sujets (WEB-E08). Correction content is withheld until unlocked. */
export default async function papersRoutes(fastify: FastifyInstance) {
  const guard = { onRequest: [fastify.authenticate, fastify.requireRole("student")] };

  fastify.get("/papers", guard, async (request, reply) => {
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

    const { data: papers, error } = branchIds.length
      ? await fastify.supabase
          .from("past_papers")
          .select("id, title, school_name, year, access_tier, unlock_price_coins, subject_id")
          .in("branch_id", branchIds)
          .eq("is_published", true)
          .order("year", { ascending: false })
      : { data: [], error: null };
    if (error) throw error;

    const paperIds = (papers ?? []).map((p) => p.id);
    const { data: unlocks } = paperIds.length
      ? await fastify.supabase
          .from("coin_ledger")
          .select("reference_id")
          .eq("student_id", request.user.sub)
          .eq("reason", "paper_unlock")
          .in("reference_id", paperIds)
      : { data: [] };
    const unlockedIds = new Set((unlocks ?? []).map((u) => u.reference_id));

    return reply.send({
      papers: (papers ?? []).map((p) => ({ ...p, unlocked: p.access_tier !== "premium" || unlockedIds.has(p.id) })),
    });
  });

  fastify.get<{ Params: { paperId: string } }>("/papers/:paperId", guard, async (request, reply) => {
    const { data: paper, error } = await fastify.supabase
      .from("past_papers")
      .select("*")
      .eq("id", request.params.paperId)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw error;
    if (!paper) return reply.code(404).send({ error: "NOT_FOUND" });

    let unlocked = paper.access_tier !== "premium";
    if (!unlocked) {
      const { count } = await fastify.supabase
        .from("coin_ledger")
        .select("id", { count: "exact", head: true })
        .eq("student_id", request.user.sub)
        .eq("reason", "paper_unlock")
        .eq("reference_id", paper.id);
      unlocked = Boolean(count);
    }

    return reply.send({
      paper: unlocked ? paper : { ...paper, correction_text: null, correction_url: null },
      unlocked,
    });
  });
}

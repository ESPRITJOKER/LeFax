import type { FastifyInstance } from "fastify";

const REASON_LABELS: Record<string, string> = {
  lesson_complete: "Leçon complétée",
  lesson_perfect_qcm: "100% aux QCMs d'une leçon",
  exam_participation: "Participation au concours blanc",
  exam_top10: "Top 10 au concours blanc",
  paper_unlock: "Débloquage d'un ancien sujet",
};

/** FaxCoins (WEB-E11). coin_ledger is append-only — no update/delete route exists (S-09). */
export default async function coinsRoutes(fastify: FastifyInstance) {
  const guard = { onRequest: [fastify.authenticate, fastify.requireRole("student")] };

  fastify.get("/coins/balance", guard, async (request, reply) => {
    const { data, error } = await fastify.supabase
      .from("coin_ledger")
      .select("amount")
      .eq("student_id", request.user.sub);
    if (error) throw error;
    const balance = (data ?? []).reduce((sum, row) => sum + row.amount, 0);
    return reply.send({ balance });
  });

  fastify.get("/coins/history", guard, async (request, reply) => {
    const { data, error } = await fastify.supabase
      .from("coin_ledger")
      .select("id, amount, reason, reference_id, created_at")
      .eq("student_id", request.user.sub)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return reply.send({ history: (data ?? []).map((row) => ({ ...row, label: REASON_LABELS[row.reason] ?? row.reason })) });
  });

  fastify.post<{ Body: unknown }>("/coins/unlock-paper", guard, async (request, reply) => {
    const paperId = (request.body as { paperId?: string })?.paperId;
    if (!paperId) return reply.code(400).send({ error: "INVALID_BODY" });

    const { data: paper } = await fastify.supabase
      .from("past_papers")
      .select("id, unlock_price_coins, access_tier")
      .eq("id", paperId)
      .maybeSingle();
    if (!paper) return reply.code(404).send({ error: "NOT_FOUND" });

    const { data: existing } = await fastify.supabase
      .from("coin_ledger")
      .select("id")
      .eq("student_id", request.user.sub)
      .eq("reason", "paper_unlock")
      .eq("reference_id", paperId)
      .maybeSingle();
    if (existing) {
      return reply.send({ alreadyUnlocked: true });
    }

    const { data: ledger } = await fastify.supabase
      .from("coin_ledger")
      .select("amount")
      .eq("student_id", request.user.sub);
    const balance = (ledger ?? []).reduce((sum, row) => sum + row.amount, 0);
    if (balance < paper.unlock_price_coins) {
      return reply.code(422).send({ error: "INSUFFICIENT_BALANCE", message: "Solde FaxCoins insuffisant." });
    }

    const { error } = await fastify.supabase.from("coin_ledger").insert({
      student_id: request.user.sub,
      amount: -paper.unlock_price_coins,
      reason: "paper_unlock",
      reference_id: paperId,
    });
    if (error) throw error;

    return reply.send({ unlocked: true, spent: paper.unlock_price_coins });
  });
}

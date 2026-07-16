import type { FastifyInstance } from "fastify";

export default async function paymentsRoutes(fastify: FastifyInstance) {
  const guard = { onRequest: [fastify.authenticate, fastify.requireRole("student")] };

  fastify.post<{ Body: { planId: string } }>("/payments/initiate", guard, async (request, reply) => {
    const { planId } = request.body;
    if (!planId) return reply.code(400).send({ error: "INVALID_BODY" });

    const { data: existing } = await fastify.supabase
      .from("subscriptions")
      .select("id, tier, status, expires_at")
      .eq("student_id", request.user.sub)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (existing) {
      return reply.code(409).send({ error: "ACTIVE_SUBSCRIPTION", subscription: existing });
    }

    const { data: student } = await fastify.supabase
      .from("profiles")
      .select("first_name, last_name, phone")
      .eq("id", request.user.sub)
      .maybeSingle();

    const amountMap: Record<string, number> = {
      standard: 5000,
      bundle: 12000,
      school: 8000,
    };

    const amount = amountMap[planId] ?? 5000;

    const config = fastify.config;
    const payload = {
      apikey: config.CINETPAY_API_KEY,
      site_id: config.CINETPAY_MERCHANT_ID,
      amount,
      currency: "XAF",
      reference_id: `LF-${request.user.sub.slice(0, 8)}-${Date.now()}`,
      description: `Lefax Course - Abonnement ${planId}`,
      customer_name: `${student?.first_name ?? ""} ${student?.last_name ?? ""}`.trim() || "Etudiant",
      customer_phone_number: student?.phone ?? "",
      metadata: JSON.stringify({ student_id: request.user.sub, plan_id: planId }),
    };

    try {
      const resp = await fetch("https://api.cinetpay.com/v2/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await resp.json() as {
        code: number;
        message: string;
        data?: { payment_url: string; payment_token: string; checkout_url: string };
      };

      if (result.code !== 201 || !result.data) {
        fastify.log.error({ result }, "CinetPay payment initiation failed");
        return reply.code(502).send({ error: "PAYMENT_INIT_FAILED", message: result.message });
      }

      await fastify.supabase.from("payments").insert({
        student_id: request.user.sub,
        cinetpay_transaction_id: result.data.payment_token,
        amount_xaf: amount,
        status: "pending",
      });

      return reply.send({
        paymentUrl: result.data.payment_url,
        checkoutUrl: result.data.checkout_url,
        token: result.data.payment_token,
      });
    } catch (err) {
      fastify.log.error({ err }, "CinetPay API error");
      return reply.code(502).send({ error: "PAYMENT_PROVIDER_ERROR" });
    }
  });

  fastify.get<{ Params: { token: string } }>("/payments/status/:token", guard, async (request, reply) => {
    const { token } = request.params;
    const { data: payment, error } = await fastify.supabase
      .from("payments")
      .select("id, status, amount_xaf, confirmed_at, created_at")
      .eq("cinetpay_transaction_id", token)
      .eq("student_id", request.user.sub)
      .maybeSingle();

    if (error || !payment) return reply.code(404).send({ error: "NOT_FOUND" });
    return reply.send({ payment });
  });

  fastify.get("/payments/history", guard, async (request, reply) => {
    const { data, error } = await fastify.supabase
      .from("payments")
      .select("id, amount_xaf, status, confirmed_at, created_at")
      .eq("student_id", request.user.sub)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    return reply.send({ payments: data ?? [] });
  });

  fastify.post("/payments/webhook", async (request, reply) => {
    const payload = request.body as Record<string, unknown>;

    const { error: insertErr } = await fastify.supabase.from("payment_webhooks_raw").insert({
      payload: JSON.stringify(payload),
    });
    if (insertErr) fastify.log.error({ insertErr }, "Failed to log raw webhook");

    const config = fastify.config;
    const webhookSecret = config.CINETPAY_WEBHOOK_SECRET;
    const cpmSigHeader = (request.headers["x-cinetpay-signature"] as string) ?? "";

    if (webhookSecret) {
      const { createHmac } = await import("node:crypto");
      const expectedSig = createHmac("sha256", webhookSecret)
        .update(JSON.stringify(payload))
        .digest("hex");

      if (cpmSigHeader !== expectedSig) {
        fastify.log.warn("CinetPay webhook signature mismatch");
        return reply.code(401).send({ error: "INVALID_SIGNATURE" });
      }
    }

    const transactionId = payload.cpm_token as string | undefined;
    const status = payload.cpm_result as string | undefined;
    const metadataStr = payload.metadata as string | undefined;

    if (!transactionId || !status) {
      return reply.code(400).send({ error: "MISSING_FIELDS" });
    }

    const { data: existingPayment } = await fastify.supabase
      .from("payments")
      .select("id, student_id, status")
      .eq("cinetpay_transaction_id", transactionId)
      .maybeSingle();

    if (!existingPayment) {
      fastify.log.warn({ transactionId }, "Webhook for unknown transaction");
      return reply.code(404).send({ error: "TRANSACTION_NOT_FOUND" });
    }

    if (existingPayment.status === "confirmed") {
      return reply.send({ ok: true, alreadyProcessed: true });
    }

    if (status === "ACCEPTED") {
      await fastify.supabase
        .from("payments")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .eq("id", existingPayment.id);

      let planId = "standard";
      if (metadataStr) {
        try {
          const meta = JSON.parse(metadataStr) as { plan_id?: string };
          if (meta.plan_id) planId = meta.plan_id;
        } catch {
        fastify.log.warn("Failed to parse payment metadata");
      }      }

      const durationDays: Record<string, number> = {
        standard: 30,
        bundle: 90,
        school: 30,
      };

      const now = new Date();
      const expires = new Date(now.getTime() + (durationDays[planId] ?? 30) * 86400000);

      await fastify.supabase.from("subscriptions").insert({
        student_id: existingPayment.student_id,
        tier: planId,
        status: "active",
        started_at: now.toISOString(),
        expires_at: expires.toISOString(),
      });

      fastify.log.info({ studentId: existingPayment.student_id, planId }, "Subscription activated via webhook");
    } else {
      await fastify.supabase
        .from("payments")
        .update({ status: "failed" })
        .eq("id", existingPayment.id);
    }

    return reply.send({ ok: true });
  });
}

import type { FastifyInstance } from "fastify";
import { createLlmProvider, type LlmMessage } from "@lefax/ai/llm";
import { BgeM3Embedder, searchRag } from "@lefax/ai/rag";
import { evaluateGrounding, TUTOR_REFUSAL_MESSAGE_FR, shouldFlag, detectSafetyDrift, SAFETY_REDIRECT_FR } from "@lefax/ai/guardrails";
import { checkQuota } from "@lefax/ai/guardrails";
import { QueueEvents } from "bullmq";

const TUTOR_SYSTEM_PROMPT = `You are Lefax AI Tutor, a Socratic study assistant for Cameroonian exam preparation (medical, engineering, agronomy schools).

RULES:
1. Answer ONLY from the provided course context. If the context doesn't contain enough information, explicitly say so.
2. Guide the student with questions. Don't just give the answer directly — help them think through it.
3. Stay strictly within academic content related to the course material.
4. If the student asks something outside lesson scope, redirect them to relevant topics.
5. Use the student's language (French or English) — match what they write.
6. Be encouraging but honest. A wrong answer is worse than no answer.
7. When referencing course content, mention the source if available.
8. For math/science: show steps, don't skip intermediate reasoning.

CONTEXT RULES:
- You receive retrieved course chunks and the student's mastery scores.
- Use mastery scores to calibrate difficulty: low score = simpler explanations, high score = more depth.
- If no relevant context is found, you MUST refuse to answer from general knowledge.`;

export default async function aiRoutes(fastify: FastifyInstance) {
  const guard = { onRequest: [fastify.authenticate, fastify.requireRole("student")] };

  // Create a new tutor session
  fastify.post("/ai/sessions", guard, async (request, reply) => {
    const { branchId } = (request.body as { branchId?: string }) ?? {};

    const { data: session, error } = await fastify.supabase
      .from("tutor_sessions")
      .insert({
        student_id: request.user.sub,
        branch_id: branchId ?? null,
        title: null,
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    return reply.send({ session });
  });

  // List student's sessions
  fastify.get("/ai/sessions", guard, async (request, reply) => {
    const { data, error } = await fastify.supabase
      .from("tutor_sessions")
      .select("id, title, created_at")
      .eq("student_id", request.user.sub)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    return reply.send({ sessions: data ?? [] });
  });

  // Get session messages
  fastify.get<{ Params: { sessionId: string } }>("/ai/sessions/:sessionId/messages", guard, async (request, reply) => {
    const { sessionId } = request.params;

    const { data: session } = await fastify.supabase
      .from("tutor_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("student_id", request.user.sub)
      .maybeSingle();

    if (!session) return reply.code(404).send({ error: "NOT_FOUND" });

    const { data: messages, error } = await fastify.supabase
      .from("tutor_messages")
      .select("id, role, content, confidence_score, tokens_used, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return reply.send({ messages: messages ?? [] });
  });

  // Send a message and get AI response
  fastify.post<{ Params: { sessionId: string }; Body: { content: string } }>(
    "/ai/sessions/:sessionId/messages",
    guard,
    async (request, reply) => {
      const { sessionId } = request.params;
      const { content } = request.body;

      if (!content?.trim()) return reply.code(400).send({ error: "EMPTY_MESSAGE" });

      // 1. Verify session ownership
      const { data: session } = await fastify.supabase
        .from("tutor_sessions")
        .select("id, student_id, branch_id")
        .eq("id", sessionId)
        .eq("student_id", request.user.sub)
        .maybeSingle();

      if (!session) return reply.code(404).send({ error: "NOT_FOUND" });

      // 2. Quota gate
      const config = fastify.config;
      const quota = await checkQuota(
        async () => {
          const { data } = await fastify.supabase
            .from("subscriptions")
            .select("tier, status, expires_at")
            .eq("student_id", request.user.sub)
            .eq("status", "active")
            .gt("expires_at", new Date().toISOString())
            .order("expires_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          return data;
        },
        async () => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const { count } = await fastify.supabase
            .from("inference_usage_log")
            .select("id", { count: "exact", head: true })
            .eq("student_id", request.user.sub)
            .eq("endpoint", "tutor_chat")
            .gte("created_at", today.toISOString());
          return count ?? 0;
        },
        config.TUTOR_DAILY_LIMIT
      );

      if (!quota.allowed) {
        const messages: Record<string, string> = {
          NO_ACTIVE_SUBSCRIPTION: "Accès au tuteur réservé aux abonnés premium.",
          SUBSCRIPTION_EXPIRED: "Votre abonnement a expiré. Renouvelez-le pour continuer.",
          FREE_TIER_NO_TUTOR_ACCESS: "L'accès au tuteur IA est réservé aux abonnés premium.",
          DAILY_LIMIT_EXCEEDED: `Limite quotidienne de ${config.TUTOR_DAILY_LIMIT} messages atteinte. Réessayez demain.`,
        };
        return reply.code(403).send({ error: quota.reason, message: messages[quota.reason ?? ""] });
      }

      // 3. Insert user message
      const { error: userMsgErr } = await fastify.supabase.from("tutor_messages").insert({
        session_id: sessionId,
        role: "user",
        content: content.trim(),
      });
      if (userMsgErr) throw userMsgErr;

      // 4. Embed the question
      const embedder = new BgeM3Embedder(config.EMBEDDING_SERVICE_URL);
      let queryEmbedding: number[];
      try {
        queryEmbedding = await embedder.embed(content.trim());
      } catch (err) {
        fastify.log.error({ err }, "Embedding failed — falling back to no-RAG response");
        queryEmbedding = [];
      }

      // 5. RAG retrieval
      let ragChunks: any[] = [];
      let similarities: number[] = [];
      if (queryEmbedding.length > 0) {
        try {
          const results = await searchRag(fastify.supabase, queryEmbedding, config.RAG_TOP_K);
          ragChunks = results;
          similarities = results.map((r: any) => r.similarity);
        } catch (err) {
          fastify.log.warn({ err }, "RAG search failed");
        }
      }

      // 6. Grounding gate
      const grounding = evaluateGrounding(similarities, config.RAG_CONFIDENCE_THRESHOLD);

      if (!grounding.isGrounded) {
        const refusalContent = TUTOR_REFUSAL_MESSAGE_FR;
        await fastify.supabase.from("tutor_messages").insert({
          session_id: sessionId,
          role: "assistant",
          content: refusalContent,
          confidence_score: grounding.confidenceScore,
          grounding_chunks: [],
          tokens_used: 0,
        });

        if (shouldFlag(grounding.confidenceScore, config.CONFIDENCE_FLAG_THRESHOLD)) {
          const { data: msg } = await fastify.supabase
            .from("tutor_messages")
            .select("id")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (msg) {
            await fastify.supabase.from("confidence_flags").insert({
              message_id: msg.id,
              confidence_score: grounding.confidenceScore,
              reason: grounding.reason ?? "LOW_CONFIDENCE",
            });
          }
        }

        return reply.send({
          message: { content: refusalContent, confidenceScore: grounding.confidenceScore },
          grounded: false,
        });
      }

      // 7. Fetch mastery scores for context
      let masteryContext = "";
      if (session.branch_id) {
        const { data: mastery } = await fastify.supabase
          .from("mastery_scores")
          .select("subject_id, topic_id, score, attempts")
          .eq("student_id", request.user.sub);

        if (mastery && mastery.length > 0) {
          const { data: subjects } = await fastify.supabase
            .from("subjects")
            .select("id, name");

          const subjectMap = new Map((subjects ?? []).map((s: any) => [s.id, s.name]));
          masteryContext = "\n\nStudent mastery scores:\n" +
            mastery.map((m: any) =>
              `- ${subjectMap.get(m.subject_id) ?? m.subject_id} / ${m.topic_id}: ${m.score}% (${m.attempts} attempts)`
            ).join("\n");
        }
      }

      // 8. Fetch conversation history (last 10 messages)
      const { data: history } = await fastify.supabase
        .from("tutor_messages")
        .select("role, content")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(10);

      const historyMsgs = (history ?? []).reverse().map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      // 9. Build LLM messages
      const contextBlock = ragChunks.length > 0
        ? "\n\nRetrieved course content:\n" + ragChunks.map((c: any) => `[Source: ${c.source_type}] ${c.content}`).join("\n\n")
        : "";

      const messages: LlmMessage[] = [
        { role: "system", content: TUTOR_SYSTEM_PROMPT + masteryContext },
        ...historyMsgs,
        { role: "user", content: content.trim() + contextBlock },
      ];

      // 10. Call LLM via BullMQ (or directly if queue unavailable)
      let llmResponse: { content: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number }; model: string };

      try {
        if (fastify.queues?.inference) {
          const job = await fastify.queues.inference.add("tutor-chat", {
            provider: config.LLM_PROVIDER,
            messages,
            temperature: 0.7,
            maxTokens: 2048,
          }, {
            jobId: `tutor-${sessionId}-${Date.now()}`,
          });

          const queueEvents = new QueueEvents("inference", {
            connection: { url: config.REDIS_URL },
          });

          llmResponse = await job.waitUntilFinished(
            queueEvents,
            30_000
          ) as any;

          await queueEvents.close();

          if (!llmResponse) throw new Error("Job did not return a result");
        } else {
          // Direct call fallback when Redis unavailable
          const provider = createLlmProvider({
            provider: config.LLM_PROVIDER as any,
            apiKey: config[`${config.LLM_PROVIDER.toUpperCase()}_API_KEY` as keyof typeof config] as string ?? "",
          });
          const result = await provider.chat(messages, { temperature: 0.7, maxTokens: 2048 });
          llmResponse = {
            content: result.content,
            usage: {
              promptTokens: (result as any).usage?.promptTokens ?? result.usage.totalTokens,
              completionTokens: (result as any).usage?.completionTokens ?? 0,
              totalTokens: result.usage.totalTokens,
            },
            model: result.model,
          };
        }
      } catch (err) {
        fastify.log.error({ err }, "LLM call failed");
        return reply.code(502).send({ error: "LLM_ERROR", message: "Le service IA est temporairement indisponible." });
      }

      const assistantContent = llmResponse.content;

      // 11. Safety check
      const safety = detectSafetyDrift(assistantContent);
      const finalContent = safety.isSafe ? assistantContent : SAFETY_REDIRECT_FR;

      // 12. Compute confidence for the response
      const responseConfidence = grounding.confidenceScore;

      // 13. Insert assistant message
      const { data: assistantMsg } = await fastify.supabase.from("tutor_messages").insert({
        session_id: sessionId,
        role: "assistant",
        content: finalContent,
        confidence_score: responseConfidence,
        grounding_chunks: ragChunks.map((c: any) => c.id),
        tokens_used: llmResponse.usage.totalTokens,
      }).select().maybeSingle();

      // 14. Log usage
      await fastify.supabase.from("inference_usage_log").insert({
        student_id: request.user.sub,
        provider: config.LLM_PROVIDER,
        model: llmResponse.model,
        prompt_tokens: llmResponse.usage.promptTokens ?? 0,
        completion_tokens: llmResponse.usage.completionTokens ?? 0,
        total_tokens: llmResponse.usage.totalTokens,
        endpoint: "tutor_chat",
      });

      // 15. Log learning event
      await fastify.supabase.from("learning_events").insert({
        student_id: request.user.sub,
        event_type: "tutor_interaction",
        metadata: {
          session_id: sessionId,
          message_count: (history?.length ?? 0) + 2,
        },
      });

      // 16. Confidence flag if needed
      if (shouldFlag(responseConfidence, config.CONFIDENCE_FLAG_THRESHOLD) && assistantMsg) {
        await fastify.supabase.from("confidence_flags").insert({
          message_id: assistantMsg.id,
          confidence_score: responseConfidence,
          reason: "LOW_RESPONSE_CONFIDENCE",
        });
      }

      return reply.send({
        message: {
          id: assistantMsg?.id,
          content: finalContent,
          confidenceScore: responseConfidence,
        },
        grounded: true,
      });
    }
  );

  // Escalate to teacher Q&A
  fastify.post<{ Params: { sessionId: string }; Body: { reason?: string } }>(
    "/ai/sessions/:sessionId/escalate",
    guard,
    async (request, reply) => {
      const { sessionId } = request.params;
      const { reason } = request.body ?? {};

      const { data: session } = await fastify.supabase
        .from("tutor_sessions")
        .select("id, branch_id")
        .eq("id", sessionId)
        .eq("student_id", request.user.sub)
        .maybeSingle();

      if (!session) return reply.code(404).send({ error: "NOT_FOUND" });

      if (!session.branch_id) {
        return reply.code(400).send({ error: "NO_BRANCH", message: "Impossible d'escalader sans filière assignée." });
      }

      const { data: lastMessages } = await fastify.supabase
        .from("tutor_messages")
        .select("content, role")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(4);

      const contextSummary = (lastMessages ?? [])
        .reverse()
        .map((m: any) => `${m.role}: ${m.content}`)
        .join("\n");

      const { error } = await fastify.supabase.from("qa_questions").insert({
        student_id: request.user.sub,
        branch_id: session.branch_id,
        title: reason ?? "Question escalée depuis le tuteur IA",
        body: contextSummary,
      });

      if (error) throw error;
      return reply.send({ escalated: true });
    }
  );
}

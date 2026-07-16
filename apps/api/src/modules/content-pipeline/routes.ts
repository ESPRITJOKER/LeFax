import type { FastifyInstance } from "fastify";
import { createLlmProvider, type LlmMessage } from "@lefax/ai/llm";
import { BgeM3Embedder, chunkText, indexChunks, searchRag } from "@lefax/ai/rag";

const DRAFT_SYSTEM_PROMPTS = {
  lesson_card: `You are an expert educator creating a lesson card for Cameroonian exam preparation.
Generate a structured lesson with:
- A clear title
- Introduction paragraph
- Key concepts with explanations
- Examples where relevant
- A summary section
Output as JSON: { "title": "...", "sections": [{ "heading": "...", "content": "..." }] }
Use the provided source material. Do not invent information.`,

  qcm: `You are an expert exam question writer for Cameroonian medical/engineering schools.
Generate a multiple-choice question (QCM) with:
- A clear question text
- 4 options (A-D), exactly one correct
- An explanation of the correct answer
- Difficulty level: easy, medium, or hard
Output as JSON: {
  "question": "...",
  "options": [
    { "label": "A", "text": "...", "correct": false },
    { "label": "B", "text": "...", "correct": true },
    { "label": "C", "text": "...", "correct": false },
    { "label": "D", "text": "...", "correct": false }
  ],
  "explanation": "...",
  "difficulty": "medium"
}
Make distractors plausible but clearly wrong to someone who knows the material.`,

  correction: `You are an expert tutor creating a step-by-step correction for an exam question.
Generate:
- The problem statement (if not provided)
- Step-by-step solution with explanations at each step
- Common mistakes to avoid
- A concise final answer
Output as JSON: {
  "problem": "...",
  "steps": [{ "step": 1, "explanation": "...", "math": "..." }],
  "common_mistakes": ["..."],
  "final_answer": "..."
}`,
};

export default async function contentPipelineRoutes(fastify: FastifyInstance) {
  const adminGuard = { onRequest: [fastify.authenticate, fastify.requireRole("admin", "teacher")] };

  // Generate a content draft
  fastify.post<{
    Body: { subjectId: string; chapterId?: string; draftType: string; topicHint?: string };
  }>("/content-pipeline/generate", adminGuard, async (request, reply) => {
    const { subjectId, chapterId, draftType, topicHint } = request.body;

    if (!["lesson_card", "qcm", "correction"].includes(draftType)) {
      return reply.code(400).send({ error: "INVALID_DRAFT_TYPE" });
    }

    const config = fastify.config;

    // Fetch subject info
    const { data: subject } = await fastify.supabase
      .from("subjects")
      .select("id, name")
      .eq("id", subjectId)
      .maybeSingle();

    if (!subject) return reply.code(404).send({ error: "SUBJECT_NOT_FOUND" });

    // Get chapter info if provided
    let chapterName = "";
    if (chapterId) {
      const { data: chapter } = await fastify.supabase
        .from("chapters")
        .select("name")
        .eq("id", chapterId)
        .maybeSingle();
      chapterName = chapter?.name ?? "";
    }

    // Embed topic hint for RAG search
    const embedder = new BgeM3Embedder(config.EMBEDDING_SERVICE_URL);
    const searchQuery = topicHint ?? subject.name + (chapterName ? ` - ${chapterName}` : "");

    let ragChunks: any[] = [];
    try {
      const queryEmbedding = await embedder.embed(searchQuery);
      ragChunks = await searchRag(fastify.supabase, queryEmbedding, 5, { subjectId });
    } catch (err) {
      fastify.log.warn({ err }, "RAG search failed for content generation");
    }

    if (ragChunks.length === 0) {
      return reply.code(422).send({
        error: "NO_SOURCE_MATERIAL",
        message: "Aucun contenu indexé trouvé pour ce sujet. Indexez du contenu d'abord.",
      });
    }

    // Build LLM prompt
    const context = ragChunks.map((c: any) => `[Source: ${c.source_type}]\n${c.content}`).join("\n\n---\n\n");
    const systemPrompt = DRAFT_SYSTEM_PROMPTS[draftType as keyof typeof DRAFT_SYSTEM_PROMPTS];

    const messages: LlmMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Subject: ${subject.name}\nChapter: ${chapterName || "General"}\nTopic: ${topicHint || "General"}\n\nSource material:\n${context}` },
    ];

    // Call LLM
    let llmResponse: { content: string; usage: { totalTokens: number }; model: string };

    try {
      const provider = createLlmProvider({
        provider: config.LLM_PROVIDER as any,
        apiKey: config[`${config.LLM_PROVIDER.toUpperCase()}_API_KEY` as keyof typeof config] as string ?? "",
      });
      const result = await provider.chat(messages, { temperature: 0.6, maxTokens: 4096 });
      llmResponse = result;
    } catch (err) {
      fastify.log.error({ err }, "LLM call failed for content generation");
      return reply.code(502).send({ error: "LLM_ERROR" });
    }

    // Parse response as JSON
    let body: Record<string, unknown>;
    try {
      const jsonMatch = llmResponse.content.match(/\{[\s\S]*\}/);
      body = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: llmResponse.content };
    } catch {
      body = { raw: llmResponse.content };
    }

    // Store draft
    const { data: draft, error: draftErr } = await fastify.supabase
      .from("content_drafts")
      .insert({
        draft_type: draftType,
        subject_id: subjectId,
        chapter_id: chapterId ?? null,
        title: (body.title as string) ?? `Draft ${draftType} - ${subject.name}`,
        body: JSON.stringify(body),
        source_chunks: ragChunks.map((c: any) => c.id),
        generation_prompt: topicHint ?? null,
        status: "pending",
      })
      .select()
      .maybeSingle();

    if (draftErr) throw draftErr;

    // Log usage
    await fastify.supabase.from("inference_usage_log").insert({
      student_id: request.user.sub,
      provider: config.LLM_PROVIDER,
      model: llmResponse.model,
      prompt_tokens: llmResponse.usage.totalTokens,
      completion_tokens: 0,
      total_tokens: llmResponse.usage.totalTokens,
      endpoint: "content_generation",
    });

    return reply.send({ draft });
  });

  // List content drafts
  fastify.get<{ Querystring: { status?: string; subjectId?: string } }>(
    "/content-pipeline/drafts",
    adminGuard,
    async (request, reply) => {
      const { status, subjectId } = request.query;

      let query = fastify.supabase
        .from("content_drafts")
        .select("*, subjects(name)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (status) query = query.eq("status", status);
      if (subjectId) query = query.eq("subject_id", subjectId);

      const { data, error } = await query;
      if (error) throw error;
      return reply.send({ drafts: data ?? [] });
    }
  );

  // Get draft with source chunks for provenance display
  fastify.get<{ Params: { draftId: string } }>(
    "/content-pipeline/drafts/:draftId/sources",
    adminGuard,
    async (request, reply) => {
      const { draftId } = request.params;

      const { data: draft } = await fastify.supabase
        .from("content_drafts")
        .select("*")
        .eq("id", draftId)
        .maybeSingle();

      if (!draft) return reply.code(404).send({ error: "NOT_FOUND" });

      const sourceChunks = (draft.source_chunks ?? []) as string[];
      let sources: any[] = [];

      if (sourceChunks.length > 0) {
        const { data: chunks } = await fastify.supabase
          .from("rag_chunks")
          .select("id, content, source_type, source_id, metadata")
          .in("id", sourceChunks);

        sources = chunks ?? [];
      }

      return reply.send({ draft, sources });
    }
  );

  // Index validated content into RAG (called when content is approved)
  fastify.post<{ Body: { sourceType: string; sourceId: string; content: string; metadata?: Record<string, unknown> } }>(
    "/content-pipeline/index",
    adminGuard,
    async (request, reply) => {
      const { sourceType, sourceId, content, metadata } = request.body;

      if (!content?.trim()) return reply.code(400).send({ error: "EMPTY_CONTENT" });

      const config = fastify.config;
      const embedder = new BgeM3Embedder(config.EMBEDDING_SERVICE_URL);

      const textChunks = chunkText(content);

      let embeddings: number[][];
      try {
        embeddings = await embedder.embedBatch(textChunks);
      } catch (err) {
        fastify.log.error({ err }, "Embedding batch failed");
        return reply.code(502).send({ error: "EMBEDDING_ERROR" });
      }

      const chunksToIndex = textChunks.map((text, i) => ({
        source_type: sourceType,
        source_id: sourceId,
        content: text,
        embedding: embeddings[i]!,
        metadata: metadata ?? {},
      }));

      await indexChunks(fastify.supabase, chunksToIndex);

      return reply.send({ indexed: chunksToIndex.length });
    }
  );
}

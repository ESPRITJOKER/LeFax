// quiz-submit — Quiz (CDC 6.4 / section 10 "Quiz: soumission réponses, score, correction")
//
// Per CDC 8.1, scoring and FaxCoins math are "traitements sensibles" that
// must run server-side, never on the client. This function is fully
// implemented (no external secrets needed): it scores the attempt, persists
// the answers, credits FaxCoins, and (for mock-exam quizzes) records a
// mock_exam_results row.

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, getUserClientAndUser } from "../_shared/supabaseAdmin.ts";

interface SubmitPayload {
  attempt_id: string | null;
  quiz_id: string;
  answers: { question_id: string; choice_id: string | null }[];
}

const BASE_COINS_PASS = 10;
const BASE_COINS_FAIL = 5;
const PERFECT_SCORE_BONUS = 10;
const MOCK_EXAM_PARTICIPATION_BONUS = 20;

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const { user, error: authError } = await getUserClientAndUser(req);
  if (authError || !user) return jsonResponse({ error: "unauthorized" }, 401);

  try {
    const payload = (await req.json()) as SubmitPayload;
    const { quiz_id, answers } = payload;
    if (!quiz_id || !Array.isArray(answers)) return jsonResponse({ error: "quiz_id and answers are required" }, 400);

    const admin = getServiceClient();

    const { data: quiz } = await admin.from("quizzes").select("*").eq("id", quiz_id).maybeSingle();
    if (!quiz) return jsonResponse({ error: "quiz not found" }, 404);

    const { data: questions } = await admin.from("questions").select("id").eq("quiz_id", quiz_id);
    const questionIds = (questions ?? []).map((q: { id: string }) => q.id);
    const { data: choices } = questionIds.length ? await admin.from("choices").select("*").in("question_id", questionIds) : { data: [] };

    // --- Scoring math -------------------------------------------------
    let correctCount = 0;
    const answerRows = answers.map((a) => {
      const choice = (choices ?? []).find((c: { id: string }) => c.id === a.choice_id);
      const isCorrect = Boolean(choice?.is_correct);
      if (isCorrect) correctCount += 1;
      return { question_id: a.question_id, choice_id: a.choice_id, is_correct: isCorrect };
    });
    const total = questionIds.length || answers.length || 1;
    const score = Math.round((correctCount / total) * 100);

    // --- Attempt bookkeeping -------------------------------------------
    let attemptId = payload.attempt_id;
    if (attemptId) {
      const { data: existing } = await admin.from("quiz_attempts").select("*").eq("id", attemptId).maybeSingle();
      if (!existing || existing.user_id !== user.id) return jsonResponse({ error: "attempt does not belong to caller" }, 403);
    } else {
      const { data: created } = await admin
        .from("quiz_attempts")
        .insert({ user_id: user.id, quiz_id, started_at: new Date().toISOString() })
        .select()
        .single();
      attemptId = created?.id;
    }

    // --- FaxCoins ledger math -------------------------------------------
    let coinsEarned = score >= quiz.passing_score ? BASE_COINS_PASS : BASE_COINS_FAIL;
    if (score === 100) coinsEarned += PERFECT_SCORE_BONUS;
    if (quiz.mock_exam_id) coinsEarned += MOCK_EXAM_PARTICIPATION_BONUS;

    await admin.from("quiz_attempts").update({ score, coins_earned: coinsEarned, submitted_at: new Date().toISOString() }).eq("id", attemptId);

    for (const row of answerRows) {
      await admin.from("student_answers").upsert({ attempt_id: attemptId, ...row }, { onConflict: "attempt_id,question_id" });
    }

    const { data: profile } = await admin.from("profiles").select("faxcoins").eq("id", user.id).single();
    const newBalance = (profile?.faxcoins ?? 0) + coinsEarned;
    await admin.from("profiles").update({ faxcoins: newBalance }).eq("id", user.id);
    await admin.from("faxcoins_transactions").insert({
      user_id: user.id,
      amount: coinsEarned,
      reason: score === 100 ? "perfect_score" : quiz.mock_exam_id ? "mock_exam_participation" : "quiz_success",
      reference_id: quiz_id,
      balance_after: newBalance,
    });

    // --- Mock exam linkage ----------------------------------------------
    if (quiz.mock_exam_id) {
      // National/regional ranks and per-subject breakdown are computed by
      // the `rankings` function once all participants have submitted; this
      // just records the raw score so that computation has something to
      // rank against.
      await admin.from("mock_exam_results").upsert(
        { mock_exam_id: quiz.mock_exam_id, user_id: user.id, attempt_id: attemptId, score, breakdown: {} },
        { onConflict: "mock_exam_id,user_id" }
      );
    }

    return jsonResponse({ score, correct: correctCount, total, coinsEarned, attemptId });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});

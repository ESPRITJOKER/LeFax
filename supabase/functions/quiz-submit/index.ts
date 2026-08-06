// quiz-submit — Quiz (CDC 6.4 / section 10 "Quiz: soumission réponses, score, correction")
//
// Per CDC 8.1, scoring and FaxCoins math are "traitements sensibles" that
// must run server-side, never on the client. This function is fully
// implemented (no external secrets needed): it scores the attempt, persists
// the answers, credits FaxCoins, and (for mock-exam quizzes) records a
// mock_exam_results row.
//
// Two actions:
//   "answer"  — submit a single answer, get immediate is_correct + hearts
//   "submit"  — batch-submit all answers (original behavior), score & close

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, getUserClientAndUser } from "../_shared/supabaseAdmin.ts";

interface AnswerPayload {
  action: "answer";
  attempt_id: string;
  quiz_id: string;
  question_id: string;
  choice_id: string | null;
}

interface SubmitPayload {
  action?: "submit";
  attempt_id: string | null;
  quiz_id: string;
  answers: { question_id: string; choice_id: string | null }[];
}

const BASE_COINS_PASS = 10;
const BASE_COINS_FAIL = 5;
const PERFECT_SCORE_BONUS = 10;
const MOCK_EXAM_PARTICIPATION_BONUS = 20;
const DEFAULT_HEARTS = 3;

// Cohort score stats (avg/high/low) for QuizResult's comparison row. Must
// run through the admin client: quiz_attempts RLS restricts SELECT to the
// caller's own rows (see 0001_init.sql's quiz_attempts_own policy), so a
// plain client-side query can never see classmates' scores.
async function getCohortStats(admin: ReturnType<typeof getServiceClient>, quizId: string) {
  const { data } = await admin.from("quiz_attempts").select("score").eq("quiz_id", quizId).not("score", "is", null);
  const scores = ((data ?? []) as { score: number | null }[])
    .map((a) => a.score)
    .filter((s): s is number => s !== null);
  if (!scores.length) return { cohortAvg: null, cohortHigh: null, cohortLow: null };
  return {
    cohortAvg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    cohortHigh: Math.max(...scores),
    cohortLow: Math.min(...scores),
  };
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const { user, error: authError } = await getUserClientAndUser(req);
  if (authError || !user) return jsonResponse({ error: "unauthorized" }, 401);

  try {
    const body = await req.json();
    const admin = getServiceClient();

    // ── Single-answer action (hearts mechanic) ──────────────────────────
    if (body.action === "answer") {
      const { attempt_id, quiz_id, question_id, choice_id } = body as AnswerPayload;
      if (!attempt_id || !quiz_id || !question_id) {
        return jsonResponse({ error: "attempt_id, quiz_id, question_id required" }, 400);
      }

      // Verify the attempt belongs to this user and is not yet submitted
      const { data: attempt } = await admin.from("quiz_attempts").select("*").eq("id", attempt_id).maybeSingle();
      if (!attempt || attempt.user_id !== user.id) {
        return jsonResponse({ error: "attempt not found or unauthorized" }, 403);
      }
      if (attempt.submitted_at) {
        return jsonResponse({ error: "attempt already submitted" }, 409);
      }

      // Score this single answer against the real answer key
      const { data: choice } = choice_id
        ? await admin.from("choices").select("is_correct").eq("id", choice_id).maybeSingle()
        : { data: null };
      const isCorrect = Boolean(choice?.is_correct);

      // Persist the student_answer row
      await admin.from("student_answers").upsert(
        { attempt_id, question_id, choice_id, is_correct: isCorrect, answered_at: new Date().toISOString() },
        { onConflict: "attempt_id,question_id" }
      );

      // Decrement hearts if wrong
      let heartsRemaining = attempt.hearts_remaining ?? DEFAULT_HEARTS;
      if (!isCorrect) {
        heartsRemaining = Math.max(0, heartsRemaining - 1);
        await admin.from("quiz_attempts").update({ hearts_remaining: heartsRemaining }).eq("id", attempt_id);
      }

      return jsonResponse({ is_correct: isCorrect, hearts_remaining: heartsRemaining });
    }

    // ── Batch-submit action (original behavior) ─────────────────────────
    const { quiz_id, answers } = body as SubmitPayload;
    if (!quiz_id || !Array.isArray(answers)) return jsonResponse({ error: "quiz_id and answers are required" }, 400);

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
    // Score over the questions actually SERVED this session, not the whole
    // quiz bank: with no-repeat shuffling (CDC Step 6) a practice session is a
    // subset of the quiz's questions, so dividing by the full bank would
    // understate the score. `answers` is exactly the served session set.
    const total = answers.length || questionIds.length || 1;
    const score = Math.round((correctCount / total) * 100);

    // --- Attempt bookkeeping -------------------------------------------
    let attemptId = body.attempt_id;
    if (attemptId) {
      const { data: existing } = await admin.from("quiz_attempts").select("*").eq("id", attemptId).maybeSingle();
      if (!existing || existing.user_id !== user.id) return jsonResponse({ error: "attempt does not belong to caller" }, 403);
      if (existing.submitted_at) {
        // Already scored by an earlier call (e.g. a client-side double-submit
        // race) — return the persisted result instead of re-crediting coins.
        const cohort = await getCohortStats(admin, quiz_id);
        return jsonResponse({ score: existing.score, correct: correctCount, total, coinsEarned: existing.coins_earned, attemptId, ...cohort });
      }
    } else {
      const { data: created } = await admin
        .from("quiz_attempts")
        .insert({ user_id: user.id, quiz_id, started_at: new Date().toISOString() })
        .select()
        .single();
      attemptId = created?.id;
    }

    // --- FaxCoins ledger math -------------------------------------------
    // Coins are earned at most once per (user, quiz). A quiz can be retaken
    // for practice, but only the first completed attempt pays out — otherwise
    // replaying a quiz would mint unlimited FaxCoins (and, since weekly
    // rankings sum attempt scores, inflate the leaderboard too).
    const { data: priorPaidAttempt } = await admin
      .from("quiz_attempts")
      .select("id")
      .eq("user_id", user.id)
      .eq("quiz_id", quiz_id)
      .not("submitted_at", "is", null)
      .gt("coins_earned", 0)
      .neq("id", attemptId)
      .limit(1)
      .maybeSingle();
    const alreadyRewarded = Boolean(priorPaidAttempt);

    let coinsEarned = 0;
    if (!alreadyRewarded) {
      coinsEarned = score >= quiz.passing_score ? BASE_COINS_PASS : BASE_COINS_FAIL;
      if (score === 100) coinsEarned += PERFECT_SCORE_BONUS;
      if (quiz.mock_exam_id) coinsEarned += MOCK_EXAM_PARTICIPATION_BONUS;
    }

    await admin.from("quiz_attempts").update({ score, coins_earned: coinsEarned, submitted_at: new Date().toISOString() }).eq("id", attemptId);

    for (const row of answerRows) {
      await admin.from("student_answers").upsert({ attempt_id: attemptId, ...row }, { onConflict: "attempt_id,question_id" });
    }

    if (coinsEarned > 0) {
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
    }

    // --- Mock exam linkage ----------------------------------------------
    if (quiz.mock_exam_id) {
      await admin.from("mock_exam_results").upsert(
        { mock_exam_id: quiz.mock_exam_id, user_id: user.id, attempt_id: attemptId, score, breakdown: {} },
        { onConflict: "mock_exam_id,user_id" }
      );
    }

    const cohort = await getCohortStats(admin, quiz_id);
    return jsonResponse({ score, correct: correctCount, total, coinsEarned, attemptId, ...cohort });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});

/**
 * Practice-bank helpers (CDC Steps 6 & 7): draw a no-repeat subset of questions
 * from a larger pool, and direct-match grading for structural answers.
 *
 * A "bank" is simply a pool of items (MCQs for a quiz, or the structural
 * questions authored across a lesson's cards) that is bigger than one practice
 * session. `question_exposure` records which items a given student has seen and
 * when, so restarts show a fresh subset.
 *
 * Exposure is deliberately NOT a "traitement sensible" (scoring / FaxCoins stay
 * server-side in the quiz-submit edge function). Reading/writing a student's own
 * exposure rows is RLS-scoped to that student, so this runs client-side and
 * matches the existing client-load pattern in Quiz.tsx.
 */
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import type { QuestionExposureRow } from "./database.types";

export type ExposureKind = QuestionExposureRow["item_kind"]; // "mcq" | "structural"

export const DEFAULT_SESSION_SIZE = 10;

/** Fisher–Yates shuffle (returns a new array; does not mutate the input). */
function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface SelectOptions<T> {
  kind: ExposureKind;
  /** The lesson the pool belongs to — scopes exposure rows. */
  topicId: string;
  /** The student. When absent (signed-out / no profile) selection is a plain shuffle. */
  userId?: string | null;
  /** The full bank to draw from. */
  pool: readonly T[];
  /** How many items to serve. Falsy → DEFAULT_SESSION_SIZE. */
  sessionSize?: number | null;
  /** Persist that these items were just served. Default true. */
  record?: boolean;
}

/**
 * Select up to `sessionSize` items from `pool`, biased away from the ones this
 * student has seen most recently:
 *   1. Never-seen items first (shuffled) — guarantees no repeat while the bank
 *      still has unseen questions.
 *   2. If that is not enough (bank exhausted), fall back to the LEAST-recently
 *      seen items — degrade gracefully, never block the student.
 * After selecting, records exposure (last_seen_at = now, seen_count += 1).
 */
export async function selectWithNoRepeat<T extends { id: string }>(opts: SelectOptions<T>): Promise<T[]> {
  const size = opts.sessionSize && opts.sessionSize > 0 ? opts.sessionSize : DEFAULT_SESSION_SIZE;
  const pool = opts.pool;
  if (pool.length === 0) return [];

  // No backend / no user → just shuffle. Still no-repeat *within* a session.
  if (!isSupabaseConfigured || !opts.userId) {
    return shuffle(pool).slice(0, size);
  }

  const ids = pool.map((p) => p.id);
  const { data: rows } = await supabase
    .from("question_exposure")
    .select("item_id, last_seen_at, seen_count")
    .eq("user_id", opts.userId)
    .eq("item_kind", opts.kind)
    .eq("topic_id", opts.topicId)
    .in("item_id", ids);

  const exposure = new Map<string, { last_seen_at: string; seen_count: number }>();
  for (const r of (rows ?? []) as Pick<QuestionExposureRow, "item_id" | "last_seen_at" | "seen_count">[]) {
    exposure.set(r.item_id, { last_seen_at: r.last_seen_at, seen_count: r.seen_count });
  }

  const unseen = pool.filter((p) => !exposure.has(p.id));
  const seen = pool
    .filter((p) => exposure.has(p.id))
    // least-recently-seen first
    .sort((a, b) => exposure.get(a.id)!.last_seen_at.localeCompare(exposure.get(b.id)!.last_seen_at));

  // Shuffle unseen so restarts differ; append least-recently-seen as fallback.
  const ordered = [...shuffle(unseen), ...seen];
  const selected = ordered.slice(0, size);

  if (opts.record !== false && selected.length) {
    const now = new Date().toISOString();
    const payload = selected.map((item) => ({
      user_id: opts.userId!,
      item_kind: opts.kind,
      item_id: item.id,
      topic_id: opts.topicId,
      last_seen_at: now,
      seen_count: (exposure.get(item.id)?.seen_count ?? 0) + 1,
    }));
    // Fire-and-forget-ish: awaited so tests can assert, but a failure must not
    // block practice (the student still gets their questions).
    const { error } = await supabase
      .from("question_exposure")
      .upsert(payload, { onConflict: "user_id,item_kind,item_id" });
    if (error) console.warn("[practiceBank] exposure upsert failed:", error.message);
  }

  return selected;
}

/**
 * Normalize a free-response answer for direct-match grading: trim, collapse
 * internal whitespace, lowercase, and strip diacritics (so "Mitochondrie" ==
 * "mitochondrie" == "MITOCHONDRIE "). Deliberately simple — see the known
 * limitation documented in content-source/README.md.
 */
export function normalizeAnswer(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Direct-match grade: true when the normalized answers are identical. */
export function gradeStructural(userAnswer: string, expected: string): boolean {
  const e = normalizeAnswer(expected);
  if (!e) return false; // no expected answer authored → cannot be "correct"
  return normalizeAnswer(userAnswer) === e;
}

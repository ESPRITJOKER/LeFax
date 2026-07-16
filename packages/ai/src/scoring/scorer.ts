import type { ScoringInput, ScoringResult } from "./algorithm.js";
import { computeEloUpdate } from "./algorithm.js";

export interface MasteryScoreRow {
  student_id: string;
  subject_id: string;
  topic_id: string;
  score: number;
  attempts: number;
}

export interface MasteryStore {
  getScore(studentId: string, subjectId: string, topicId: string): Promise<MasteryScoreRow | null>;
  upsertScore(row: MasteryScoreRow): Promise<void>;
  getTopicAverage(subjectId: string, topicId: string): Promise<number>;
}

export async function updateMastery(
  store: MasteryStore,
  input: ScoringInput
): Promise<ScoringResult> {
  const existing = await store.getScore(input.studentId, input.subjectId, input.topicId);

  const oldScore = existing?.score ?? 50;
  const topicAverage = await store.getTopicAverage(input.subjectId, input.topicId);

  const { newScore } = computeEloUpdate(oldScore, topicAverage, input.isCorrect, input.difficulty);

  await store.upsertScore({
    student_id: input.studentId,
    subject_id: input.subjectId,
    topic_id: input.topicId,
    score: newScore,
    attempts: (existing?.attempts ?? 0) + 1,
  });

  return {
    studentId: input.studentId,
    subjectId: input.subjectId,
    topicId: input.topicId,
    oldScore,
    newScore,
    attempts: (existing?.attempts ?? 0) + 1,
  };
}

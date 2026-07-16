export interface ScoringInput {
  studentId: string;
  subjectId: string;
  topicId: string;
  isCorrect: boolean;
  difficulty: "easy" | "medium" | "hard";
  timestamp?: Date;
}

export interface ScoringResult {
  studentId: string;
  subjectId: string;
  topicId: string;
  oldScore: number;
  newScore: number;
  attempts: number;
}

const DIFFICULTY_WEIGHTS: Record<string, number> = {
  easy: 0.8,
  medium: 1.0,
  hard: 1.2,
};

const BASE_K = 32;

function expectedScore(currentScore: number, topicAverage: number): number {
  return 1 / (1 + Math.pow(10, (topicAverage - currentScore) / 400));
}

export function computeEloUpdate(
  currentScore: number,
  topicAverage: number,
  isCorrect: boolean,
  difficulty: "easy" | "medium" | "hard"
): { newScore: number; delta: number } {
  const actual = isCorrect ? 1.0 : 0.0;
  const exp = expectedScore(currentScore, topicAverage);
  const weight = DIFFICULTY_WEIGHTS[difficulty] ?? 1.0;
  const delta = Math.round(BASE_K * weight * (actual - exp));
  const newScore = Math.max(0, Math.min(100, Math.round(currentScore + delta)));
  return { newScore, delta };
}

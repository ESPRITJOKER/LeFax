export interface GroundingResult {
  isGrounded: boolean;
  confidenceScore: number;
  topSimilarity: number;
  chunksAboveThreshold: number;
  reason?: string;
}

export function evaluateGrounding(
  similarities: number[],
  threshold: number = 0.5
): GroundingResult {
  if (similarities.length === 0) {
    return {
      isGrounded: false,
      confidenceScore: 0,
      topSimilarity: 0,
      chunksAboveThreshold: 0,
      reason: "NO_CHUNKS_RETRIEVED",
    };
  }

  const sorted = [...similarities].sort((a, b) => b - a);
  const topSimilarity = sorted[0] ?? 0;
  const chunksAboveThreshold = sorted.filter((s) => s >= threshold).length;

  if (topSimilarity < threshold) {
    return {
      isGrounded: false,
      confidenceScore: topSimilarity,
      topSimilarity,
      chunksAboveThreshold,
      reason: "TOP_SIMILARITY_BELOW_THRESHOLD",
    };
  }

  if (chunksAboveThreshold < 1) {
    return {
      isGrounded: false,
      confidenceScore: topSimilarity * 0.5,
      topSimilarity,
      chunksAboveThreshold,
      reason: "INSUFFICIENT_GROUNDING",
    };
  }

  const confidenceScore = Math.min(
    1,
    topSimilarity * 0.6 + (Math.min(chunksAboveThreshold, 3) / 3) * 0.4
  );

  return {
    isGrounded: confidenceScore >= threshold,
    confidenceScore,
    topSimilarity,
    chunksAboveThreshold,
  };
}

export const TUTOR_REFUSAL_MESSAGE_FR =
  "Je ne trouve pas d'informations fiables dans le contenu du cours pour répondre à cette question avec certitude. " +
  "Plutôt que de risquer de te donner une réponse incorrecte, je te recommande de poser cette question à ton enseignant " +
  "via la section Q&A du cours.";

export const TUTOR_REFUSAL_MESSAGE_EN =
  "I don't find reliable information in the course content to answer this question with certainty. " +
  "Rather than risk giving you an incorrect answer, I recommend asking your teacher through the Q&A section.";

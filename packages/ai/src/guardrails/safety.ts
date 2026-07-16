export interface ConfidenceFlag {
  messageId: string;
  confidenceScore: number;
  reason: string;
}

export function shouldFlag(confidenceScore: number, threshold: number = 0.7): boolean {
  return confidenceScore < threshold;
}

export const SAFETY_PATTERNS = [
  /politique|election|gouvernement|parti\s+politique/i,
  /宗教|宗教信仰|信仰/i,
  /viagra|casino|betting|pari/i,
  /dating|rencontre|romance/i,
];

export function detectSafetyDrift(text: string): { isSafe: boolean; matchedPattern?: string } {
  for (const pattern of SAFETY_PATTERNS) {
    if (pattern.test(text)) {
      return { isSafe: false, matchedPattern: pattern.source };
    }
  }
  return { isSafe: true };
}

export const SAFETY_REDIRECT_FR =
  "Je suis un assistant d'études académiques. Je ne peux pas répondre à des questions en dehors du contenu du cours. " +
  "Revenons à tes leçons — sur quel sujet veux-tu travailler ?";

export const SAFETY_REDIRECT_EN =
  "I am an academic study assistant. I cannot answer questions outside the course content. " +
  "Let's get back to your lessons — which topic would you like to work on?";

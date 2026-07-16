/**
 * The 6 CDC branches (§1.4 / §3.1). This is the real content, subscription
 * and exam scoping unit — "target schools" (Polytechnique, FMSB, ...) are
 * display-only metadata pointing at one of these, not a separate hierarchy.
 */
export const BRANCH_SLUGS = [
  "medecine",
  "ingenierie",
  "agronomie",
  "management",
  "infirmerie",
  "enseignement",
] as const;

export type BranchSlug = (typeof BRANCH_SLUGS)[number];

export const LAUNCH_BRANCH: BranchSlug = "medecine";

import { z } from "zod";
import { BRANCH_SLUGS } from "./branches.js";

/** WEB-E02: multi-select, minimum 1 branch. */
export const selectBranchesRequestSchema = z.object({
  branchSlugs: z.array(z.enum(BRANCH_SLUGS)).min(1),
});
export type SelectBranchesRequest = z.infer<typeof selectBranchesRequestSchema>;

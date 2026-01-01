/**
 * Phase 3 Scanner Exports
 */

export { scanCommentClaimUnproven } from "./comment-claim-unproven.js";
export { scanMiddlewareAssumedNotMatching } from "./middleware-assumed-not-matching.js";
export { scanValidationClaimedMissing } from "./validation-claimed-missing.js";
export { scanAuthByUiServerGap } from "./auth-by-ui-server-gap.js";

import type { Scanner } from "../../scanners/types.js";
import { scanCommentClaimUnproven } from "./comment-claim-unproven.js";
import { scanMiddlewareAssumedNotMatching } from "./middleware-assumed-not-matching.js";
import { scanValidationClaimedMissing } from "./validation-claimed-missing.js";
import { scanAuthByUiServerGap } from "./auth-by-ui-server-gap.js";

/**
 * All Phase 3 scanners
 */
export const phase3Scanners: Scanner[] = [
  scanCommentClaimUnproven,
  scanMiddlewareAssumedNotMatching,
  scanValidationClaimedMissing,
  scanAuthByUiServerGap,
];

/**
 * Phase 3 Hallucination Pack
 */
export const hallucinationsPack = {
  id: "hallucinations",
  name: "Hallucinations Pack (Phase 3)",
  scanners: [
    scanCommentClaimUnproven,
    scanMiddlewareAssumedNotMatching,
    scanValidationClaimedMissing,
  ],
};

/**
 * Phase 3 Auth Pack extension
 */
export const authPackPhase3 = {
  id: "auth-phase3",
  name: "Auth Pack (Phase 3)",
  scanners: [scanAuthByUiServerGap],
};

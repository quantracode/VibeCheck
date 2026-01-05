/**
 * Lifecycle Scanner Pack
 *
 * Detects security invariant violations across create/read/update/delete
 * operations on the same entity. These scanners ensure consistent security
 * controls are applied throughout an entity's lifecycle.
 *
 * Rules:
 * - VC-LIFE-001: Create protected, update not protected
 * - VC-LIFE-002: POST validated, PUT/PATCH not validated (schema drift)
 * - VC-LIFE-003: Delete endpoint lacks rate limiting where others have it
 */

import type { ScannerPack } from "../types.js";
import { scanCreateUpdateAsymmetry } from "./create-update-asymmetry.js";
import { scanValidationSchemaDrift } from "./validation-schema-drift.js";
import { scanDeleteRateLimitGap } from "./delete-rate-limit-gap.js";

export const lifecyclePack: ScannerPack = {
  id: "lifecycle",
  name: "Lifecycle Security Invariants",
  scanners: [
    scanCreateUpdateAsymmetry,
    scanValidationSchemaDrift,
    scanDeleteRateLimitGap,
  ],
};

// Export individual scanners for testing
export { scanCreateUpdateAsymmetry } from "./create-update-asymmetry.js";
export { scanValidationSchemaDrift } from "./validation-schema-drift.js";
export { scanDeleteRateLimitGap } from "./delete-rate-limit-gap.js";

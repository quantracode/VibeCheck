import type { ScannerPack } from "../types.js";
import { scanAdminRouteNoRoleGuard } from "./admin-route-no-role-guard.js";
import { scanOwnershipCheckMissing } from "./ownership-check-missing.js";
import { scanRoleDeclaredNotEnforced } from "./role-declared-not-enforced.js";
import { scanTrustedClientId } from "./trusted-client-id.js";

export { scanAdminRouteNoRoleGuard } from "./admin-route-no-role-guard.js";
export { scanOwnershipCheckMissing } from "./ownership-check-missing.js";
export { scanRoleDeclaredNotEnforced } from "./role-declared-not-enforced.js";
export { scanTrustedClientId } from "./trusted-client-id.js";

/**
 * Authorization scanner pack
 *
 * Detects missing authorization semantics beyond just authentication checks.
 * These rules identify patterns where auth exists but authorization logic
 * (role guards, ownership checks, access control) is missing.
 */
export const authorizationPack: ScannerPack = {
  id: "authorization",
  name: "Authorization Semantics",
  scanners: [
    scanAdminRouteNoRoleGuard,
    scanOwnershipCheckMissing,
    scanRoleDeclaredNotEnforced,
    scanTrustedClientId,
  ],
};

/**
 * Supply Chain scanner pack
 *
 * Analyzes package.json and lockfiles for supply chain risks:
 * - VC-SUP-001: Postinstall scripts in project
 * - VC-SUP-002: Version ranges on security-critical libs
 * - VC-SUP-003: Deprecated/vulnerable packages
 * - VC-SUP-004: Multiple auth systems detected
 * - VC-SUP-005: Suspicious install scripts in dependencies
 */

import type { ScannerPack } from "../types.js";
import { scanPostinstallScripts } from "./postinstall-scripts.js";
import { scanVersionRanges } from "./version-ranges.js";
import { scanDeprecatedPackages } from "./deprecated-packages-scanner.js";
import { scanMultipleAuthSystems } from "./multiple-auth-systems.js";
import { scanSuspiciousScripts } from "./suspicious-scripts.js";

export { scanPostinstallScripts } from "./postinstall-scripts.js";
export { scanVersionRanges } from "./version-ranges.js";
export { scanDeprecatedPackages } from "./deprecated-packages-scanner.js";
export { scanMultipleAuthSystems } from "./multiple-auth-systems.js";
export { scanSuspiciousScripts } from "./suspicious-scripts.js";

// Re-export utilities
export * from "./lockfile-parser.js";
export * from "./deprecated-packages.js";
export * from "./security-critical-packages.js";

export const supplyChainPack: ScannerPack = {
  id: "supply-chain",
  name: "Supply Chain Security",
  scanners: [
    scanPostinstallScripts,
    scanVersionRanges,
    scanDeprecatedPackages,
    scanMultipleAuthSystems,
    scanSuspiciousScripts,
  ],
};

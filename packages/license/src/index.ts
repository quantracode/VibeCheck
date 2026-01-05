/**
 * @vibecheck/license
 *
 * License management for VibeCheck.
 *
 * Browser usage (verification only):
 *   import { validateLicense, parseLicenseKey } from '@vibecheck/license';
 *
 * Node.js usage (issuing + verification):
 *   import { createLicense, generateKeyPair, validateLicense } from '@vibecheck/license';
 */

// Types - always available
export * from "./types.js";

// Constants - always available
export {
  VIBECHECK_PUBLIC_KEY_B64,
  isDemoModeAllowed,
  LICENSE_FORMAT_VERSION,
} from "./constants.js";

// Verification - browser + Node.js compatible
export {
  validateLicense,
  parseLicenseKey,
  hasFeature,
  getDaysRemaining,
} from "./verify.js";

// Issuing - Node.js only (will fail in browser)
// These are re-exported but should only be imported in Node.js environments
export {
  generateKeyPair,
  createLicense,
  createDemoLicense,
  derivePublicKey,
  inspectLicense,
} from "./issue.js";

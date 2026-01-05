/**
 * License system constants
 *
 * IMPORTANT: The public key here is used for production license verification.
 * The private key is kept secure and used only by authorized license issuers.
 */

/**
 * VibeCheck public key for license verification (Base64 encoded SPKI format)
 *
 * This Ed25519 public key is embedded in both the CLI and web app.
 * All production licenses must be signed with the corresponding private key.
 *
 * To generate a new key pair, use: pnpm --filter @vibecheck/license keygen
 */
export const VIBECHECK_PUBLIC_KEY_B64 =
  "MCowBQYDK2VwAyEAN2JawZEm3mmUmYXAg+uPjh9XSLMmfwdg2Hrq3W8ueoU=";

/**
 * Demo public key (used for development/testing only)
 * This is a separate key pair to ensure demo licenses are clearly distinguishable.
 */
export const DEMO_PUBLIC_KEY_B64 =
  "MCowBQYDK2VwAyEAzDEMOkEyDEMOkEyDEMOkEyDEMOkEyDEMOkEyDEMOw==";

/**
 * Environment check for demo mode
 * Demo licenses are only valid in development/testing environments.
 */
export function isDemoModeAllowed(): boolean {
  // In browser context
  if (typeof window !== "undefined") {
    // Allow demo in localhost only
    return (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    );
  }

  // In Node.js context
  if (typeof process !== "undefined") {
    return (
      process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "test" ||
      process.env.VIBECHECK_ALLOW_DEMO === "true"
    );
  }

  return false;
}

/**
 * License format version for future compatibility
 */
export const LICENSE_FORMAT_VERSION = 1;

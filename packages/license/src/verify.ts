/**
 * License verification for VibeCheck
 *
 * This module is designed to work in both Node.js and browser environments.
 * It uses the Web Crypto API (crypto.subtle) for Ed25519 signature verification.
 */

import {
  VIBECHECK_PUBLIC_KEY_B64,
  isDemoModeAllowed,
} from "./constants.js";
import {
  type License,
  type LicensePayload,
  type LicenseValidationResult,
  isDemoLicense,
} from "./types.js";

/**
 * Import the public key for verification
 */
async function importPublicKey(keyB64: string): Promise<CryptoKey> {
  const keyData = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    "spki",
    keyData,
    { name: "Ed25519" },
    false,
    ["verify"]
  );
}

/**
 * Verify a signature against payload
 */
async function verifySignature(
  payload: string,
  signatureB64: string,
  publicKey: CryptoKey
): Promise<boolean> {
  try {
    const signature = Uint8Array.from(atob(signatureB64), (c) =>
      c.charCodeAt(0)
    );
    const data = new TextEncoder().encode(payload);

    return crypto.subtle.verify({ name: "Ed25519" }, publicKey, signature, data);
  } catch {
    return false;
  }
}

/**
 * Parse a license key string into License object
 * License format: base64(JSON payload).base64(signature)
 */
export function parseLicenseKey(licenseKey: string): License | null {
  try {
    const parts = licenseKey.trim().split(".");
    if (parts.length !== 2) return null;

    const [payloadB64, signature] = parts;
    const payloadJson = atob(payloadB64);
    const payload = JSON.parse(payloadJson) as LicensePayload;

    // Basic structure validation (email is optional for portal-issued keys)
    if (!payload.id || !payload.plan || !payload.issuedAt) {
      return null;
    }

    return { payload, signature };
  } catch {
    return null;
  }
}

/**
 * Validate a license key
 *
 * @param licenseKey - The license key string to validate
 * @param options - Validation options
 * @returns Validation result with license details if valid
 */
export async function validateLicense(
  licenseKey: string,
  options: {
    /** Override public key for testing */
    publicKey?: string;
    /** Skip signature verification (for testing only) */
    skipSignature?: boolean;
  } = {}
): Promise<LicenseValidationResult> {
  // Parse the license
  const license = parseLicenseKey(licenseKey);
  if (!license) {
    return { valid: false, license: null, error: "Invalid license format" };
  }

  const isDemo = isDemoLicense(license.payload.id);

  // Check if demo licenses are allowed in this environment
  if (isDemo && !isDemoModeAllowed()) {
    return {
      valid: false,
      license: null,
      error: "Demo licenses are not valid in production",
      isDemo: true,
    };
  }

  // Check expiry
  if (license.payload.expiresAt) {
    const expiryDate = new Date(license.payload.expiresAt);
    if (expiryDate < new Date()) {
      return {
        valid: false,
        license,
        error: "License has expired",
        isDemo,
      };
    }
  }

  // Demo licenses skip cryptographic verification (they're for dev/testing only)
  if (isDemo) {
    console.info("[License] Demo license detected - valid in development mode");
    return { valid: true, license, error: undefined, isDemo: true };
  }

  // Skip signature verification if requested (testing only)
  if (options.skipSignature) {
    return { valid: true, license, error: undefined, isDemo: false };
  }

  // Verify signature for production licenses
  try {
    const publicKeyB64 = options.publicKey ?? VIBECHECK_PUBLIC_KEY_B64;
    const publicKey = await importPublicKey(publicKeyB64);
    const payloadB64 = licenseKey.split(".")[0];
    const isValid = await verifySignature(
      atob(payloadB64),
      license.signature,
      publicKey
    );

    if (!isValid) {
      return {
        valid: false,
        license: null,
        error: "Invalid license signature",
        isDemo: false,
      };
    }
  } catch (err) {
    // If Ed25519 not supported (older browsers), provide a clear error
    const message =
      err instanceof Error ? err.message : "Unknown cryptographic error";
    return {
      valid: false,
      license: null,
      error: `License verification failed: ${message}`,
      isDemo: false,
    };
  }

  return { valid: true, license, error: undefined, isDemo: false };
}

/**
 * Check if a specific feature is enabled by a license
 */
export function hasFeature(license: License | null, feature: string): boolean {
  if (!license) return false;
  return license.payload.features.includes(feature);
}

/**
 * Get remaining days until license expiry
 */
export function getDaysRemaining(license: License): number | null {
  if (!license.payload.expiresAt) return null;

  const expiryDate = new Date(license.payload.expiresAt);
  const now = new Date();
  const diff = expiryDate.getTime() - now.getTime();

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

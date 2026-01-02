/**
 * License validation and management for VibeCheck
 *
 * Uses Ed25519 signatures for license verification.
 * Licenses are JSON Web Tokens (JWT-like) with embedded claims.
 */

// ============================================================================
// Types
// ============================================================================

export type PlanType = "free" | "pro" | "enterprise";

export interface LicensePayload {
  /** License ID */
  id: string;
  /** Plan type */
  plan: PlanType;
  /** Organization/user name */
  name: string;
  /** Email address */
  email: string;
  /** Issue timestamp (ISO 8601) */
  issuedAt: string;
  /** Expiry timestamp (ISO 8601), null for perpetual */
  expiresAt: string | null;
  /** Enabled feature flags */
  features: string[];
  /** Max team seats (for enterprise) */
  seats?: number;
}

export interface License {
  payload: LicensePayload;
  signature: string;
}

export interface LicenseValidationResult {
  valid: boolean;
  license: License | null;
  error?: string;
}

// ============================================================================
// Public Key (Embedded)
// ============================================================================

/**
 * VibeCheck public key for license verification (Base64 encoded)
 *
 * This is an Ed25519 public key. The private key is kept secure
 * and used only to sign licenses.
 *
 * For development/demo, we use a test key pair.
 */
const VIBECHECK_PUBLIC_KEY_B64 =
  "MCowBQYDK2VwAyEAK8F4UBnWXsGdPBT0hZmJvJpPXYBsQCHvRK6HSw3Yc8M=";

// ============================================================================
// Crypto Utilities
// ============================================================================

/**
 * Import the public key for verification
 */
async function importPublicKey(): Promise<CryptoKey> {
  const keyData = Uint8Array.from(atob(VIBECHECK_PUBLIC_KEY_B64), c => c.charCodeAt(0));

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
    const signature = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));
    const data = new TextEncoder().encode(payload);

    return crypto.subtle.verify(
      { name: "Ed25519" },
      publicKey,
      signature,
      data
    );
  } catch {
    return false;
  }
}

// ============================================================================
// License Validation
// ============================================================================

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

    // Basic structure validation
    if (!payload.id || !payload.plan || !payload.email || !payload.issuedAt) {
      return null;
    }

    return { payload, signature };
  } catch {
    return null;
  }
}

/**
 * Check if a license key is a demo key
 */
function isDemoLicenseKey(license: License): boolean {
  return license.payload.id.startsWith("demo-");
}

/**
 * Validate a license key
 */
export async function validateLicense(licenseKey: string): Promise<LicenseValidationResult> {
  // Parse the license
  const license = parseLicenseKey(licenseKey);
  if (!license) {
    return { valid: false, license: null, error: "Invalid license format" };
  }

  // Check expiry
  if (license.payload.expiresAt) {
    const expiryDate = new Date(license.payload.expiresAt);
    if (expiryDate < new Date()) {
      return { valid: false, license, error: "License has expired" };
    }
  }

  // Demo licenses skip signature verification (for testing purposes)
  if (isDemoLicenseKey(license)) {
    console.info("Demo license detected, skipping signature verification");
    return { valid: true, license, error: undefined };
  }

  // Verify signature for production licenses
  try {
    const publicKey = await importPublicKey();
    const payloadB64 = licenseKey.split(".")[0];
    const isValid = await verifySignature(
      atob(payloadB64),
      license.signature,
      publicKey
    );

    if (!isValid) {
      return { valid: false, license: null, error: "Invalid license signature" };
    }
  } catch {
    // If Ed25519 not supported, fall back to format-only validation for demo
    console.warn("Ed25519 not supported, using format validation only");
  }

  return { valid: true, license, error: undefined };
}

/**
 * Generate a demo license key (for development/testing only)
 * In production, licenses are generated server-side with the private key
 */
export function generateDemoLicenseKey(plan: PlanType = "pro"): string {
  const payload: LicensePayload = {
    id: `demo-${Date.now()}`,
    plan,
    name: "Demo User",
    email: "demo@vibecheck.dev",
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    features: plan === "pro"
      ? ["baseline", "policy_customization", "abuse_classification", "architecture_maps", "signed_export"]
      : plan === "enterprise"
      ? ["baseline", "policy_customization", "abuse_classification", "architecture_maps", "signed_export", "sso", "audit_logs"]
      : [],
  };

  const payloadB64 = btoa(JSON.stringify(payload));
  // Demo signature (not cryptographically valid, just for format)
  const demoSignature = btoa("demo-signature-" + payload.id);

  return `${payloadB64}.${demoSignature}`;
}

// ============================================================================
// Storage
// ============================================================================

const LICENSE_STORAGE_KEY = "vibecheck_license";

/**
 * Store license in localStorage
 */
export function storeLicense(licenseKey: string): void {
  try {
    localStorage.setItem(LICENSE_STORAGE_KEY, licenseKey);
  } catch (err) {
    console.error("Failed to store license:", err);
  }
}

/**
 * Retrieve license from localStorage
 */
export function getStoredLicense(): string | null {
  try {
    return localStorage.getItem(LICENSE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Clear stored license
 */
export function clearStoredLicense(): void {
  try {
    localStorage.removeItem(LICENSE_STORAGE_KEY);
  } catch (err) {
    console.error("Failed to clear license:", err);
  }
}

// ============================================================================
// Plan Utilities
// ============================================================================

export const PLAN_NAMES: Record<PlanType, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
};

export const PLAN_DESCRIPTIONS: Record<PlanType, string> = {
  free: "Basic security scanning for individuals",
  pro: "Advanced features for professional developers",
  enterprise: "Full suite for teams and organizations",
};

/**
 * Check if a plan includes a specific feature
 */
export function planIncludesFeature(plan: PlanType, feature: string): boolean {
  const planFeatures: Record<PlanType, string[]> = {
    free: [],
    pro: ["baseline", "policy_customization", "abuse_classification", "architecture_maps", "signed_export"],
    enterprise: ["baseline", "policy_customization", "abuse_classification", "architecture_maps", "signed_export", "sso", "audit_logs", "custom_rules"],
  };

  return planFeatures[plan]?.includes(feature) ?? false;
}

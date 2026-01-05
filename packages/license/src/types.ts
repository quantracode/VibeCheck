/**
 * License types for VibeCheck
 *
 * These types are shared between the CLI (issuing) and web app (verification).
 * Licenses are verified offline using Ed25519 cryptographic signatures.
 */

export type PlanType = "free" | "pro";

/**
 * License payload - the data that gets signed
 *
 * Privacy-preserving: email is optional. For portal-issued keys,
 * only a hashed customer ID is stored (not personally identifiable).
 */
export interface LicensePayload {
  /** License ID (UUID or custom identifier) */
  id: string;
  /** Plan type */
  plan: PlanType;
  /** Organization/user name (optional) */
  name?: string;
  /** Email address (optional - for backwards compatibility) */
  email?: string;
  /** Hashed customer ID for portal-issued keys (privacy-preserving) */
  customerId?: string;
  /** Issue timestamp (ISO 8601) */
  issuedAt: string;
  /** Expiry timestamp (ISO 8601), null for perpetual */
  expiresAt: string | null;
  /** Enabled feature flags */
  features: string[];
}

/**
 * A complete license with payload and signature
 */
export interface License {
  payload: LicensePayload;
  signature: string;
}

/**
 * Result of license validation
 */
export interface LicenseValidationResult {
  valid: boolean;
  license: License | null;
  error?: string;
  /** True if this is a demo/trial license */
  isDemo?: boolean;
}

/**
 * Options for creating a new license
 */
export interface CreateLicenseOptions {
  /** License ID (auto-generated if not provided) */
  id?: string;
  /** Plan type */
  plan: PlanType;
  /** Organization/user name (optional) */
  name?: string;
  /** Email address (optional) */
  email?: string;
  /** Hashed customer ID for portal-issued keys */
  customerId?: string;
  /** Expiry date (null for perpetual) */
  expiresAt?: Date | null;
  /** Additional features to enable */
  features?: string[];
}

/**
 * Feature flags by plan
 */
export const PLAN_FEATURES: Record<PlanType, string[]> = {
  free: [],
  pro: [
    "baseline",
    "policy_customization",
    "abuse_classification",
    "architecture_maps",
    "signed_export",
  ],
};

/**
 * Plan display names
 */
export const PLAN_NAMES: Record<PlanType, string> = {
  free: "Free",
  pro: "Pro",
};

/**
 * Check if a license ID indicates a demo license
 */
export function isDemoLicense(licenseId: string): boolean {
  return licenseId.startsWith("demo-") || licenseId.startsWith("trial-");
}

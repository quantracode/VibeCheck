/**
 * License validation and management for VibeCheck Web UI
 *
 * This module wraps the @vibecheck/license package for browser use.
 * Demo licenses are only available in development (localhost).
 */

// Re-export types from shared package
export type {
  License,
  LicensePayload,
  LicenseValidationResult,
  PlanType,
} from "@vibecheck/license";

export {
  PLAN_NAMES,
  PLAN_FEATURES,
  isDemoLicense,
  isDemoModeAllowed,
} from "@vibecheck/license";

// Import verification functions
import {
  validateLicense as validateLicenseShared,
  parseLicenseKey as parseLicenseKeyShared,
  getDaysRemaining,
  hasFeature,
  type License,
  type LicensePayload,
  type LicenseValidationResult,
  type PlanType,
  PLAN_FEATURES,
  isDemoModeAllowed,
} from "@vibecheck/license";

// ============================================================================
// Wrapper Functions
// ============================================================================

/**
 * Validate a license key
 */
export async function validateLicense(
  licenseKey: string
): Promise<LicenseValidationResult> {
  return validateLicenseShared(licenseKey);
}

/**
 * Parse a license key string into License object
 */
export function parseLicenseKey(licenseKey: string): License | null {
  return parseLicenseKeyShared(licenseKey);
}

// ============================================================================
// Demo License Generation (Development Only)
// ============================================================================

/**
 * Generate a demo license key (for development/testing only)
 *
 * IMPORTANT: This function only works on localhost.
 * In production, users must obtain real licenses.
 */
export function generateDemoLicenseKey(plan: PlanType = "pro"): string | null {
  // Only allow demo generation on localhost
  if (!isDemoModeAllowed()) {
    console.warn("[License] Demo licenses are not available in production");
    return null;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const payload: LicensePayload = {
    id: `demo-${Date.now()}`,
    plan,
    name: "Demo User",
    email: "demo@vibecheck.dev",
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    features: PLAN_FEATURES[plan] ?? [],
  };

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = btoa(payloadJson);
  // Demo signature (not cryptographically valid)
  const demoSignature = btoa("demo-signature-" + payload.id);

  return `${payloadB64}.${demoSignature}`;
}

/**
 * Check if demo mode is available in current environment
 */
export function canGenerateDemoLicense(): boolean {
  return isDemoModeAllowed();
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

export const PLAN_DESCRIPTIONS: Record<PlanType, string> = {
  free: "Basic security scanning for individuals",
  pro: "Advanced features for professional developers",
  enterprise: "Full suite for teams and organizations",
};

/**
 * Check if a plan includes a specific feature
 */
export function planIncludesFeature(plan: PlanType, feature: string): boolean {
  return PLAN_FEATURES[plan]?.includes(feature) ?? false;
}

// Re-export utility functions
export { getDaysRemaining, hasFeature };

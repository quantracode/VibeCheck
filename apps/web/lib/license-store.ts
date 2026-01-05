"use client";

import { create } from "zustand";
import {
  validateLicense,
  getStoredLicense,
  storeLicense,
  clearStoredLicense,
  type License,
  type LicensePayload,
  type PlanType,
} from "./license";
import { isFeatureAvailable, type FeatureId } from "./features";

// ============================================================================
// Store Types
// ============================================================================

interface LicenseState {
  // State
  license: License | null;
  licenseKey: string | null;
  isLoading: boolean;
  isValidating: boolean;
  error: string | null;
  initialized: boolean;

  // Computed getters
  plan: PlanType;
  isLicensed: boolean;

  // Actions
  initialize: () => Promise<void>;
  activateLicense: (licenseKey: string) => Promise<boolean>;
  deactivateLicense: () => void;
  clearError: () => void;

  // Feature checks
  canUseFeature: (featureId: FeatureId) => boolean;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useLicenseStore = create<LicenseState>((set, get) => ({
  // Initial state
  license: null,
  licenseKey: null,
  isLoading: false,
  isValidating: false,
  error: null,
  initialized: false,

  // Computed getters
  get plan(): PlanType {
    return get().license?.payload.plan ?? "free";
  },

  get isLicensed(): boolean {
    return get().license !== null;
  },

  // Initialize from stored license (fully offline - no network calls)
  initialize: async () => {
    if (get().initialized) return;

    set({ isLoading: true });

    try {
      const storedKey = getStoredLicense();

      if (storedKey) {
        const result = await validateLicense(storedKey);

        if (result.valid && result.license) {
          set({
            license: result.license,
            licenseKey: storedKey,
            isLoading: false,
            initialized: true,
          });
          return;
        } else {
          // Invalid stored license, clear it
          clearStoredLicense();
        }
      }

      set({
        license: null,
        licenseKey: null,
        isLoading: false,
        initialized: true,
      });
    } catch {
      set({
        error: "Failed to initialize license",
        isLoading: false,
        initialized: true,
      });
    }
  },

  // Activate a new license (offline validation only)
  activateLicense: async (licenseKey: string) => {
    set({ isValidating: true, error: null });

    try {
      const result = await validateLicense(licenseKey);

      if (result.valid && result.license) {
        storeLicense(licenseKey);
        set({
          license: result.license,
          licenseKey,
          isValidating: false,
          error: null,
        });
        return true;
      } else {
        set({
          isValidating: false,
          error: result.error ?? "Invalid license",
        });
        return false;
      }
    } catch {
      set({
        isValidating: false,
        error: "Failed to validate license",
      });
      return false;
    }
  },

  // Deactivate current license
  deactivateLicense: () => {
    clearStoredLicense();
    set({
      license: null,
      licenseKey: null,
      error: null,
    });
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },

  // Check if a feature is available
  canUseFeature: (featureId: FeatureId) => {
    const license = get().license;
    return isFeatureAvailable(featureId, license?.payload ?? null);
  },
}));

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to check if a specific feature is available
 */
export function useFeatureAccess(featureId: FeatureId): {
  hasAccess: boolean;
  plan: PlanType;
  isLoading: boolean;
} {
  const license = useLicenseStore((state) => state.license);
  const isLoading = useLicenseStore((state) => state.isLoading);
  const initialized = useLicenseStore((state) => state.initialized);

  const plan: PlanType = license?.payload.plan ?? "free";
  const hasAccess = initialized ? isFeatureAvailable(featureId, license?.payload ?? null) : false;

  return {
    hasAccess,
    plan,
    isLoading: isLoading || !initialized,
  };
}

/**
 * Hook to get license info
 */
export function useLicenseInfo(): {
  license: LicensePayload | null;
  plan: PlanType;
  isLicensed: boolean;
  expiresAt: Date | null;
  daysRemaining: number | null;
} {
  const license = useLicenseStore((state) => state.license);

  const plan: PlanType = license?.payload.plan ?? "free";
  const isLicensed = license !== null;

  const expiresAt = license?.payload.expiresAt
    ? new Date(license.payload.expiresAt)
    : null;

  const daysRemaining = expiresAt
    ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    license: license?.payload ?? null,
    plan,
    isLicensed,
    expiresAt,
    daysRemaining,
  };
}

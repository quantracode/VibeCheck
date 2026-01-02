/**
 * Feature flags system for VibeCheck
 *
 * Defines gated features and their requirements.
 */

import type { PlanType, LicensePayload } from "./license";

// ============================================================================
// Feature Definitions
// ============================================================================

export type FeatureId =
  | "baseline"
  | "policy_customization"
  | "abuse_classification"
  | "architecture_maps"
  | "signed_export"
  | "sso"
  | "audit_logs"
  | "custom_rules";

export interface FeatureDefinition {
  id: FeatureId;
  name: string;
  description: string;
  /** Minimum plan required */
  minPlan: PlanType;
  /** Category for grouping */
  category: "analysis" | "policy" | "export" | "enterprise";
  /** Whether feature is coming soon (not implemented yet) */
  comingSoon?: boolean;
}

export const FEATURES: Record<FeatureId, FeatureDefinition> = {
  baseline: {
    id: "baseline",
    name: "Baseline Comparison",
    description: "Compare scans against a baseline to detect regressions",
    minPlan: "pro",
    category: "analysis",
  },
  policy_customization: {
    id: "policy_customization",
    name: "Policy Customization",
    description: "Customize policy thresholds and create custom profiles",
    minPlan: "pro",
    category: "policy",
  },
  abuse_classification: {
    id: "abuse_classification",
    name: "Abuse Classification",
    description: "AI-powered classification of potential abuse vectors",
    minPlan: "pro",
    category: "analysis",
  },
  architecture_maps: {
    id: "architecture_maps",
    name: "Visual Architecture Maps",
    description: "Interactive visual maps of your security architecture",
    minPlan: "pro",
    category: "analysis",
  },
  signed_export: {
    id: "signed_export",
    name: "Signed Report Export",
    description: "Export cryptographically signed security reports",
    minPlan: "pro",
    category: "export",
    comingSoon: true,
  },
  sso: {
    id: "sso",
    name: "SSO Integration",
    description: "Single sign-on with SAML/OIDC providers",
    minPlan: "enterprise",
    category: "enterprise",
    comingSoon: true,
  },
  audit_logs: {
    id: "audit_logs",
    name: "Audit Logs",
    description: "Comprehensive audit logging for compliance",
    minPlan: "enterprise",
    category: "enterprise",
    comingSoon: true,
  },
  custom_rules: {
    id: "custom_rules",
    name: "Custom Rules",
    description: "Create custom security rules for your organization",
    minPlan: "enterprise",
    category: "policy",
    comingSoon: true,
  },
};

// ============================================================================
// Feature Access
// ============================================================================

const PLAN_HIERARCHY: Record<PlanType, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
};

/**
 * Check if a plan meets the minimum requirement
 */
export function planMeetsMinimum(userPlan: PlanType, minPlan: PlanType): boolean {
  return PLAN_HIERARCHY[userPlan] >= PLAN_HIERARCHY[minPlan];
}

/**
 * Check if a feature is available for a given license
 */
export function isFeatureAvailable(
  featureId: FeatureId,
  license: LicensePayload | null
): boolean {
  const feature = FEATURES[featureId];
  if (!feature) return false;

  // Coming soon features are never available
  if (feature.comingSoon) return false;

  // No license = free plan
  if (!license) return feature.minPlan === "free";

  // Check if plan meets minimum OR feature explicitly granted
  return (
    planMeetsMinimum(license.plan, feature.minPlan) ||
    license.features.includes(featureId)
  );
}

/**
 * Get list of features available for a plan
 */
export function getAvailableFeatures(plan: PlanType): FeatureId[] {
  return Object.values(FEATURES)
    .filter((f) => !f.comingSoon && planMeetsMinimum(plan, f.minPlan))
    .map((f) => f.id);
}

/**
 * Get list of locked features for a plan (excluding coming soon)
 */
export function getLockedFeatures(plan: PlanType): FeatureId[] {
  return Object.values(FEATURES)
    .filter((f) => !f.comingSoon && !planMeetsMinimum(plan, f.minPlan))
    .map((f) => f.id);
}

/**
 * Get the upgrade plan needed for a feature
 */
export function getUpgradePlanForFeature(featureId: FeatureId): PlanType | null {
  const feature = FEATURES[featureId];
  if (!feature) return null;
  return feature.minPlan;
}

// ============================================================================
// Feature Categories
// ============================================================================

export const FEATURE_CATEGORIES = {
  analysis: {
    name: "Analysis",
    description: "Advanced analysis capabilities",
  },
  policy: {
    name: "Policy",
    description: "Policy customization and rules",
  },
  export: {
    name: "Export",
    description: "Report export features",
  },
  enterprise: {
    name: "Enterprise",
    description: "Enterprise-grade features",
  },
};

/**
 * Get features grouped by category
 */
export function getFeaturesByCategory(): Record<string, FeatureDefinition[]> {
  const grouped: Record<string, FeatureDefinition[]> = {};

  for (const feature of Object.values(FEATURES)) {
    if (!grouped[feature.category]) {
      grouped[feature.category] = [];
    }
    grouped[feature.category].push(feature);
  }

  return grouped;
}

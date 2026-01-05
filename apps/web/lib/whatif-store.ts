"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Finding, Severity } from "@vibecheck/schema";

// ============================================================================
// Types
// ============================================================================

/**
 * What-If override actions
 */
export type WhatIfAction =
  | "ignore" // Completely ignore the finding
  | "downgrade" // Reduce severity
  | "waive"; // Temporary waiver

/**
 * What-If override for a specific finding
 */
export interface WhatIfOverride {
  findingId: string;
  fingerprint: string;
  action: WhatIfAction;
  newSeverity?: Severity; // For downgrade action
  reason: string;
  createdAt: string;
}

/**
 * What-If path pattern ignore
 */
export interface WhatIfPathIgnore {
  id: string;
  pathPattern: string;
  ruleId?: string; // Optional: only ignore for specific rule
  reason: string;
  createdAt: string;
}

/**
 * What-If simulation state
 */
interface WhatIfState {
  // Mode toggle
  isEnabled: boolean;

  // Finding-level overrides
  overrides: WhatIfOverride[];

  // Path pattern ignores
  pathIgnores: WhatIfPathIgnore[];

  // Actions
  toggleMode: () => void;
  setEnabled: (enabled: boolean) => void;

  // Override actions
  addOverride: (override: Omit<WhatIfOverride, "createdAt">) => void;
  removeOverride: (findingId: string) => void;
  getOverride: (findingId: string) => WhatIfOverride | undefined;
  hasOverride: (findingId: string) => boolean;

  // Path ignore actions
  addPathIgnore: (ignore: Omit<WhatIfPathIgnore, "id" | "createdAt">) => void;
  removePathIgnore: (id: string) => void;

  // Bulk operations
  clearAllOverrides: () => void;
  clearAll: () => void;

  // Stats
  getOverrideCount: () => number;
  getPathIgnoreCount: () => number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `wi-${timestamp}-${random}`;
}

// ============================================================================
// Store
// ============================================================================

export const useWhatIfStore = create<WhatIfState>()(
  persist(
    (set, get) => ({
      // Initial state
      isEnabled: false,
      overrides: [],
      pathIgnores: [],

      // Mode toggle
      toggleMode: () => {
        set((state) => ({ isEnabled: !state.isEnabled }));
      },

      setEnabled: (enabled: boolean) => {
        set({ isEnabled: enabled });
      },

      // Override actions
      addOverride: (override) => {
        const { overrides } = get();
        // Remove existing override for same finding
        const filtered = overrides.filter((o) => o.findingId !== override.findingId);
        set({
          overrides: [
            ...filtered,
            {
              ...override,
              createdAt: new Date().toISOString(),
            },
          ],
        });
      },

      removeOverride: (findingId: string) => {
        set((state) => ({
          overrides: state.overrides.filter((o) => o.findingId !== findingId),
        }));
      },

      getOverride: (findingId: string) => {
        return get().overrides.find((o) => o.findingId === findingId);
      },

      hasOverride: (findingId: string) => {
        return get().overrides.some((o) => o.findingId === findingId);
      },

      // Path ignore actions
      addPathIgnore: (ignore) => {
        set((state) => ({
          pathIgnores: [
            ...state.pathIgnores,
            {
              ...ignore,
              id: generateId(),
              createdAt: new Date().toISOString(),
            },
          ],
        }));
      },

      removePathIgnore: (id: string) => {
        set((state) => ({
          pathIgnores: state.pathIgnores.filter((p) => p.id !== id),
        }));
      },

      // Bulk operations
      clearAllOverrides: () => {
        set({ overrides: [] });
      },

      clearAll: () => {
        set({ overrides: [], pathIgnores: [], isEnabled: false });
      },

      // Stats
      getOverrideCount: () => {
        return get().overrides.length;
      },

      getPathIgnoreCount: () => {
        return get().pathIgnores.length;
      },
    }),
    {
      name: "vibecheck-whatif",
      partialize: (state) => ({
        isEnabled: state.isEnabled,
        overrides: state.overrides,
        pathIgnores: state.pathIgnores,
      }),
    }
  )
);

// ============================================================================
// Derived Helpers
// ============================================================================

/**
 * Apply What-If overrides to findings and return modified findings
 * This is a pure function for use in the evaluator
 */
export function applyWhatIfOverrides(
  findings: Finding[],
  overrides: WhatIfOverride[],
  pathIgnores: WhatIfPathIgnore[]
): {
  activeFindings: Finding[];
  ignoredFindings: Array<{ finding: Finding; override: WhatIfOverride | WhatIfPathIgnore }>;
  modifiedFindings: Array<{ finding: Finding; override: WhatIfOverride; originalSeverity: Severity }>;
} {
  const activeFindings: Finding[] = [];
  const ignoredFindings: Array<{ finding: Finding; override: WhatIfOverride | WhatIfPathIgnore }> = [];
  const modifiedFindings: Array<{ finding: Finding; override: WhatIfOverride; originalSeverity: Severity }> = [];

  const overrideByFindingId = new Map(overrides.map((o) => [o.findingId, o]));
  const overrideByFingerprint = new Map(overrides.map((o) => [o.fingerprint, o]));

  for (const finding of findings) {
    // Check for finding-level override
    const override = overrideByFindingId.get(finding.id) ?? overrideByFingerprint.get(finding.fingerprint);

    if (override) {
      if (override.action === "ignore" || override.action === "waive") {
        ignoredFindings.push({ finding, override });
        continue;
      }

      if (override.action === "downgrade" && override.newSeverity) {
        // Create modified finding with new severity
        const modifiedFinding: Finding = {
          ...finding,
          severity: override.newSeverity,
        };
        activeFindings.push(modifiedFinding);
        modifiedFindings.push({
          finding: modifiedFinding,
          override,
          originalSeverity: finding.severity,
        });
        continue;
      }
    }

    // Check for path pattern ignores
    const evidencePaths = finding.evidence.map((e) => e.file);
    let pathIgnored = false;

    for (const pathIgnore of pathIgnores) {
      // Check rule match if specified
      if (pathIgnore.ruleId && !matchRuleId(finding.ruleId, pathIgnore.ruleId)) {
        continue;
      }

      // Check path pattern match
      if (matchPathPattern(evidencePaths, pathIgnore.pathPattern)) {
        ignoredFindings.push({ finding, override: pathIgnore });
        pathIgnored = true;
        break;
      }
    }

    if (!pathIgnored) {
      activeFindings.push(finding);
    }
  }

  return { activeFindings, ignoredFindings, modifiedFindings };
}

/**
 * Match rule ID against pattern (supports wildcard suffix)
 */
function matchRuleId(ruleId: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return ruleId.startsWith(prefix);
  }
  return ruleId === pattern;
}

/**
 * Match path against glob pattern (simple implementation)
 * For browser compatibility, we use a simple glob matcher
 */
function matchPathPattern(evidencePaths: string[], pattern: string): boolean {
  // Normalize pattern to regex
  const regexPattern = pattern
    .replace(/\\/g, "/")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/{{GLOBSTAR}}/g, ".*")
    .replace(/\?/g, ".");

  const regex = new RegExp(`^${regexPattern}$`);

  return evidencePaths.some((path) => {
    const normalizedPath = path.replace(/\\/g, "/");
    return regex.test(normalizedPath);
  });
}

/**
 * Get severity order for comparison
 */
export function getSeverityOrder(severity: Severity): number {
  const order: Record<Severity, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
    info: 0,
  };
  return order[severity];
}

/**
 * Get next lower severity
 */
export function getLowerSeverity(severity: Severity): Severity {
  const levels: Severity[] = ["info", "low", "medium", "high", "critical"];
  const index = levels.indexOf(severity);
  return index > 0 ? levels[index - 1] : severity;
}

/**
 * Heatmap Builder
 *
 * Builds a deterministic heatmap model from scan artifacts
 * showing route protection status across security categories.
 */

import type {
  ScanArtifact,
  RouteEntry,
  Finding,
} from "@vibecheck/schema";

// ============================================================================
// Types
// ============================================================================

export type ProtectionStatus = "protected" | "missing" | "unknown";

export interface ProtectionCell {
  status: ProtectionStatus;
  tooltip: string;
  evidence?: {
    file?: string;
    line?: number;
    snippet?: string;
    findingId?: string;
  };
}

export interface RouteProtectionRow {
  routeId: string;
  method: string;
  path: string;
  file: string;
  line?: number;
  isStateChanging: boolean;
  protections: {
    auth: ProtectionCell;
    validation: ProtectionCell;
    middleware: ProtectionCell;
    rateLimit: ProtectionCell;
    uploads: ProtectionCell;
  };
  hasGaps: boolean;
  findingCount: number;
  findingIds: string[];
}

export interface HeatmapData {
  routes: RouteProtectionRow[];
  columns: Array<{
    key: keyof RouteProtectionRow["protections"];
    label: string;
    description: string;
  }>;
  summary: {
    totalRoutes: number;
    stateChangingRoutes: number;
    routesWithGaps: number;
    protectionCounts: Record<keyof RouteProtectionRow["protections"], {
      protected: number;
      missing: number;
      unknown: number;
    }>;
  };
}

export interface CoverageRadarData {
  axes: Array<{
    key: string;
    label: string;
    value: number; // 0-100 percentage
    count: number;
    total: number;
  }>;
}

// ============================================================================
// Constants
// ============================================================================

const STATE_CHANGING_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

const PROTECTION_COLUMNS: HeatmapData["columns"] = [
  { key: "auth", label: "Auth", description: "Authentication check present" },
  { key: "validation", label: "Validation", description: "Input validation present" },
  { key: "middleware", label: "Middleware", description: "Covered by middleware.ts" },
  { key: "rateLimit", label: "Rate Limit", description: "Rate limiting protection" },
  { key: "uploads", label: "Uploads", description: "Safe file upload handling" },
];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get routes from artifact (handles both legacy and new format)
 */
function getRoutes(artifact: ScanArtifact): RouteEntry[] {
  if (!artifact.routeMap) return [];
  if (Array.isArray(artifact.routeMap)) return artifact.routeMap;
  return artifact.routeMap.routes ?? [];
}

/**
 * Get middleware coverage for a route
 */
function getMiddlewareCoverage(
  artifact: ScanArtifact,
  routeId: string
): { covered: boolean; reason?: string } {
  if (!artifact.middlewareMap) return { covered: false };
  if (Array.isArray(artifact.middlewareMap)) return { covered: false };

  const coverage = artifact.middlewareMap.coverage?.find(
    (c) => c.routeId === routeId
  );
  return {
    covered: coverage?.covered ?? false,
    reason: coverage?.reason,
  };
}

/**
 * Get proof trace for a route
 */
function getProofTrace(
  artifact: ScanArtifact,
  routeId: string
): { summary: string; nodes: Array<{ kind: string; label: string; file?: string; line?: number }> } | null {
  const traces = artifact.proofTraces;
  if (!traces || typeof traces !== "object") return null;
  return (traces as Record<string, { summary: string; nodes: Array<{ kind: string; label: string; file?: string; line?: number }> }>)[routeId] ?? null;
}

/**
 * Get findings for a route file
 */
function getRouteFindings(findings: Finding[], routeFile: string): Finding[] {
  const normalizedFile = routeFile.replace(/\\/g, "/");
  return findings.filter((f) => {
    const evidence = f.evidence[0];
    if (!evidence) return false;
    const evidenceFile = evidence.file.replace(/\\/g, "/");
    return evidenceFile.includes(normalizedFile) || normalizedFile.includes(evidenceFile);
  });
}

/**
 * Check if route has auth protection
 */
function checkAuthProtection(
  artifact: ScanArtifact,
  route: RouteEntry,
  routeFindings: Finding[]
): ProtectionCell {
  const trace = getProofTrace(artifact, route.routeId);
  const middlewareCoverage = getMiddlewareCoverage(artifact, route.routeId);

  // Check for auth-related findings (indicates missing auth)
  const authFindings = routeFindings.filter(
    (f) => f.category === "auth" || f.ruleId.startsWith("VC-AUTH")
  );

  if (authFindings.length > 0) {
    const finding = authFindings[0];
    return {
      status: "missing",
      tooltip: `Missing auth: ${finding.title}`,
      evidence: {
        file: finding.evidence[0]?.file,
        line: finding.evidence[0]?.startLine,
        snippet: finding.evidence[0]?.snippet?.slice(0, 100),
        findingId: finding.id,
      },
    };
  }

  // Check proof trace for auth
  if (trace?.summary?.toLowerCase().includes("auth")) {
    return {
      status: "protected",
      tooltip: "Auth protection detected via proof trace",
      evidence: {
        file: route.file,
        line: route.startLine,
      },
    };
  }

  // Check middleware coverage
  if (middlewareCoverage.covered) {
    return {
      status: "protected",
      tooltip: "Protected by middleware",
      evidence: {
        file: "middleware.ts",
      },
    };
  }

  // GET routes may not need auth
  if (route.method === "GET") {
    return {
      status: "unknown",
      tooltip: "GET route - auth may not be required",
    };
  }

  return {
    status: "unknown",
    tooltip: "Auth status could not be determined",
  };
}

/**
 * Check if route has validation
 */
function checkValidationProtection(
  artifact: ScanArtifact,
  route: RouteEntry,
  routeFindings: Finding[]
): ProtectionCell {
  const trace = getProofTrace(artifact, route.routeId);

  // Check for validation-related findings
  const valFindings = routeFindings.filter(
    (f) => f.category === "validation" || f.ruleId.startsWith("VC-VAL")
  );

  if (valFindings.length > 0) {
    const finding = valFindings[0];
    return {
      status: "missing",
      tooltip: `Missing validation: ${finding.title}`,
      evidence: {
        file: finding.evidence[0]?.file,
        line: finding.evidence[0]?.startLine,
        findingId: finding.id,
      },
    };
  }

  // Check proof trace for validation patterns
  const validationPatterns = [/valid/i, /zod/i, /schema/i, /parse/i, /safeParse/i];
  if (trace) {
    const hasValidation = trace.nodes.some((node) =>
      validationPatterns.some((p) => p.test(node.label))
    );
    if (hasValidation) {
      const validatorNode = trace.nodes.find((node) =>
        validationPatterns.some((p) => p.test(node.label))
      );
      return {
        status: "protected",
        tooltip: `Validation: ${validatorNode?.label}`,
        evidence: {
          file: validatorNode?.file,
          line: validatorNode?.line,
        },
      };
    }
  }

  // GET routes typically don't need body validation
  if (route.method === "GET") {
    return {
      status: "unknown",
      tooltip: "GET route - body validation may not be required",
    };
  }

  return {
    status: "unknown",
    tooltip: "Validation status could not be determined",
  };
}

/**
 * Check middleware coverage
 */
function checkMiddlewareProtection(
  artifact: ScanArtifact,
  route: RouteEntry,
  routeFindings: Finding[]
): ProtectionCell {
  const coverage = getMiddlewareCoverage(artifact, route.routeId);

  // Check for middleware-related findings
  const mwFindings = routeFindings.filter(
    (f) => f.category === "middleware" || f.ruleId.startsWith("VC-MW")
  );

  if (mwFindings.length > 0) {
    const finding = mwFindings[0];
    return {
      status: "missing",
      tooltip: `Middleware issue: ${finding.title}`,
      evidence: {
        file: finding.evidence[0]?.file,
        line: finding.evidence[0]?.startLine,
        findingId: finding.id,
      },
    };
  }

  if (coverage.covered) {
    return {
      status: "protected",
      tooltip: coverage.reason || "Covered by middleware.ts",
      evidence: {
        file: "middleware.ts",
      },
    };
  }

  return {
    status: "missing",
    tooltip: "Not covered by middleware matcher",
  };
}

/**
 * Check rate limiting
 */
function checkRateLimitProtection(
  artifact: ScanArtifact,
  route: RouteEntry,
  routeFindings: Finding[]
): ProtectionCell {
  // Check for rate limit findings
  const rlFindings = routeFindings.filter(
    (f) => f.ruleId === "VC-RATE-001" || f.title.toLowerCase().includes("rate")
  );

  if (rlFindings.length > 0) {
    const finding = rlFindings[0];
    return {
      status: "missing",
      tooltip: `Missing rate limit: ${finding.title}`,
      evidence: {
        file: finding.evidence[0]?.file,
        line: finding.evidence[0]?.startLine,
        findingId: finding.id,
      },
    };
  }

  // Check proof trace for rate limiting
  const trace = getProofTrace(artifact, route.routeId);
  if (trace) {
    const hasRateLimit = trace.nodes.some((node) =>
      /rate|limit|throttle/i.test(node.label)
    );
    if (hasRateLimit) {
      return {
        status: "protected",
        tooltip: "Rate limiting detected",
      };
    }
  }

  // Check middleware coverage (often includes rate limiting)
  const mwCoverage = getMiddlewareCoverage(artifact, route.routeId);
  if (mwCoverage.covered) {
    return {
      status: "unknown",
      tooltip: "May be rate limited via middleware",
    };
  }

  return {
    status: "unknown",
    tooltip: "Rate limiting status unknown",
  };
}

/**
 * Check upload handling
 */
function checkUploadProtection(
  artifact: ScanArtifact,
  route: RouteEntry,
  routeFindings: Finding[]
): ProtectionCell {
  // Check for upload-related findings
  const uploadFindings = routeFindings.filter(
    (f) => f.category === "uploads" || f.ruleId.startsWith("VC-UP")
  );

  if (uploadFindings.length > 0) {
    const finding = uploadFindings[0];
    return {
      status: "missing",
      tooltip: `Upload issue: ${finding.title}`,
      evidence: {
        file: finding.evidence[0]?.file,
        line: finding.evidence[0]?.startLine,
        findingId: finding.id,
      },
    };
  }

  // Check if route handles uploads (by path or method)
  const isUploadRoute = /upload|file|image|media|attachment/i.test(route.path);
  if (!isUploadRoute && route.method === "GET") {
    return {
      status: "unknown",
      tooltip: "Route does not appear to handle uploads",
    };
  }

  if (isUploadRoute) {
    // No findings = assumed safe
    return {
      status: "protected",
      tooltip: "No upload vulnerabilities detected",
    };
  }

  return {
    status: "unknown",
    tooltip: "Upload handling status unknown",
  };
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Build heatmap data from a scan artifact
 */
export function buildHeatmapData(artifact: ScanArtifact): HeatmapData {
  const routes = getRoutes(artifact);
  const findings = artifact.findings;

  const routeRows: RouteProtectionRow[] = [];

  for (const route of routes) {
    const routeFindings = getRouteFindings(findings, route.file);
    const isStateChanging = STATE_CHANGING_METHODS.includes(route.method);

    const protections = {
      auth: checkAuthProtection(artifact, route, routeFindings),
      validation: checkValidationProtection(artifact, route, routeFindings),
      middleware: checkMiddlewareProtection(artifact, route, routeFindings),
      rateLimit: checkRateLimitProtection(artifact, route, routeFindings),
      uploads: checkUploadProtection(artifact, route, routeFindings),
    };

    // Determine if route has gaps (missing protections on state-changing routes)
    const hasGaps = isStateChanging && (
      protections.auth.status === "missing" ||
      protections.validation.status === "missing" ||
      protections.middleware.status === "missing"
    );

    routeRows.push({
      routeId: route.routeId,
      method: route.method,
      path: route.path,
      file: route.file,
      line: route.startLine,
      isStateChanging,
      protections,
      hasGaps,
      findingCount: routeFindings.length,
      findingIds: routeFindings.map((f) => f.id),
    });
  }

  // Sort deterministically by method then path
  routeRows.sort((a, b) => {
    const methodOrder = ["GET", "POST", "PUT", "PATCH", "DELETE"];
    const aMethodIdx = methodOrder.indexOf(a.method);
    const bMethodIdx = methodOrder.indexOf(b.method);
    if (aMethodIdx !== bMethodIdx) return aMethodIdx - bMethodIdx;
    return a.path.localeCompare(b.path);
  });

  // Calculate summary
  const summary = {
    totalRoutes: routeRows.length,
    stateChangingRoutes: routeRows.filter((r) => r.isStateChanging).length,
    routesWithGaps: routeRows.filter((r) => r.hasGaps).length,
    protectionCounts: {
      auth: { protected: 0, missing: 0, unknown: 0 },
      validation: { protected: 0, missing: 0, unknown: 0 },
      middleware: { protected: 0, missing: 0, unknown: 0 },
      rateLimit: { protected: 0, missing: 0, unknown: 0 },
      uploads: { protected: 0, missing: 0, unknown: 0 },
    },
  };

  for (const row of routeRows) {
    for (const key of Object.keys(row.protections) as Array<keyof typeof row.protections>) {
      summary.protectionCounts[key][row.protections[key].status]++;
    }
  }

  return {
    routes: routeRows,
    columns: PROTECTION_COLUMNS,
    summary,
  };
}

/**
 * Build coverage radar data from artifact
 */
export function buildCoverageRadarData(artifact: ScanArtifact): CoverageRadarData {
  const routes = getRoutes(artifact);
  const findings = artifact.findings;
  const metrics = artifact.metrics;

  // Calculate coverage for each category
  const categories = [
    { key: "auth", label: "Authentication" },
    { key: "validation", label: "Validation" },
    { key: "middleware", label: "Middleware" },
    { key: "crypto", label: "Cryptography" },
    { key: "network", label: "Network" },
    { key: "privacy", label: "Privacy" },
  ];

  const axes: CoverageRadarData["axes"] = [];

  for (const cat of categories) {
    let value = 100;
    let count = 0;
    let total = 0;

    switch (cat.key) {
      case "auth": {
        const stateChanging = routes.filter((r) =>
          STATE_CHANGING_METHODS.includes(r.method)
        );
        total = stateChanging.length;
        const authFindings = findings.filter(
          (f) => f.category === "auth" || f.ruleId.startsWith("VC-AUTH")
        );
        // Assume routes without auth findings are protected
        count = total - new Set(authFindings.map((f) => f.evidence[0]?.file)).size;
        value = total > 0 ? Math.round((count / total) * 100) : 100;
        break;
      }
      case "validation": {
        const stateChanging = routes.filter((r) =>
          STATE_CHANGING_METHODS.includes(r.method)
        );
        total = stateChanging.length;
        const valFindings = findings.filter(
          (f) => f.category === "validation" || f.ruleId.startsWith("VC-VAL")
        );
        count = total - new Set(valFindings.map((f) => f.evidence[0]?.file)).size;
        value = total > 0 ? Math.round((count / total) * 100) : 100;
        break;
      }
      case "middleware": {
        if (metrics?.middlewareCoverage) {
          total = metrics.middlewareCoverage.totalApiRoutes;
          count = metrics.middlewareCoverage.coveredApiRoutes;
          value = total > 0 ? Math.round((count / total) * 100) : 100;
        } else {
          total = routes.length;
          const mwFindings = findings.filter((f) => f.category === "middleware");
          count = total - mwFindings.length;
          value = total > 0 ? Math.round((count / total) * 100) : 100;
        }
        break;
      }
      case "crypto": {
        const cryptoFindings = findings.filter(
          (f) => f.category === "crypto" || f.ruleId.startsWith("VC-CRYPTO")
        );
        total = routes.length;
        // Less crypto findings = better coverage
        count = Math.max(0, total - cryptoFindings.length);
        value = total > 0 ? Math.round((count / total) * 100) : 100;
        break;
      }
      case "network": {
        const networkFindings = findings.filter(
          (f) => f.category === "network" || f.ruleId.startsWith("VC-NET") || f.ruleId.startsWith("VC-RATE")
        );
        total = routes.length;
        count = Math.max(0, total - networkFindings.length);
        value = total > 0 ? Math.round((count / total) * 100) : 100;
        break;
      }
      case "privacy": {
        const privacyFindings = findings.filter(
          (f) => f.category === "privacy" || f.ruleId.startsWith("VC-PRIV")
        );
        total = routes.length;
        count = Math.max(0, total - privacyFindings.length);
        value = total > 0 ? Math.round((count / total) * 100) : 100;
        break;
      }
    }

    axes.push({
      key: cat.key,
      label: cat.label,
      value: Math.min(100, Math.max(0, value)),
      count,
      total,
    });
  }

  return { axes };
}

/**
 * Filter heatmap data by criteria
 */
export function filterHeatmapData(
  data: HeatmapData,
  options: {
    stateChangingOnly?: boolean;
    gapsOnly?: boolean;
    searchQuery?: string;
  }
): HeatmapData {
  let routes = [...data.routes];

  if (options.stateChangingOnly) {
    routes = routes.filter((r) => r.isStateChanging);
  }

  if (options.gapsOnly) {
    routes = routes.filter((r) => r.hasGaps);
  }

  if (options.searchQuery?.trim()) {
    const query = options.searchQuery.toLowerCase();
    routes = routes.filter(
      (r) =>
        r.path.toLowerCase().includes(query) ||
        r.method.toLowerCase().includes(query) ||
        r.file.toLowerCase().includes(query)
    );
  }

  // Recalculate summary for filtered data
  const summary = {
    totalRoutes: routes.length,
    stateChangingRoutes: routes.filter((r) => r.isStateChanging).length,
    routesWithGaps: routes.filter((r) => r.hasGaps).length,
    protectionCounts: {
      auth: { protected: 0, missing: 0, unknown: 0 },
      validation: { protected: 0, missing: 0, unknown: 0 },
      middleware: { protected: 0, missing: 0, unknown: 0 },
      rateLimit: { protected: 0, missing: 0, unknown: 0 },
      uploads: { protected: 0, missing: 0, unknown: 0 },
    },
  };

  for (const row of routes) {
    for (const key of Object.keys(row.protections) as Array<keyof typeof row.protections>) {
      summary.protectionCounts[key][row.protections[key].status]++;
    }
  }

  return {
    routes,
    columns: data.columns,
    summary,
  };
}

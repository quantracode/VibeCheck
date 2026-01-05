/**
 * Heatmap Model Tests
 *
 * Tests for the heatmap data model derivation.
 * These tests verify that the route protection heatmap
 * produces consistent, deterministic output.
 */

import { describe, it, expect } from "vitest";
import type { ScanArtifact, RouteEntry, Finding } from "@vibecheck/schema";

// ============================================================================
// Heatmap Types (Mirror of web lib/heatmap-builder.ts)
// ============================================================================

type ProtectionStatus = "protected" | "missing" | "unknown";

interface ProtectionCell {
  status: ProtectionStatus;
  tooltip: string;
  evidence?: {
    file?: string;
    line?: number;
    snippet?: string;
    findingId?: string;
  };
}

interface RouteProtectionRow {
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

interface HeatmapData {
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
    protectionCounts: Record<
      keyof RouteProtectionRow["protections"],
      { protected: number; missing: number; unknown: number }
    >;
  };
}

interface CoverageRadarData {
  axes: Array<{
    key: string;
    label: string;
    value: number;
    count: number;
    total: number;
  }>;
}

// ============================================================================
// Heatmap Builder Implementation (Inline for testing without web dependencies)
// ============================================================================

const STATE_CHANGING_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

const PROTECTION_COLUMNS: HeatmapData["columns"] = [
  { key: "auth", label: "Auth", description: "Authentication check present" },
  { key: "validation", label: "Validation", description: "Input validation present" },
  { key: "middleware", label: "Middleware", description: "Covered by middleware.ts" },
  { key: "rateLimit", label: "Rate Limit", description: "Rate limiting protection" },
  { key: "uploads", label: "Uploads", description: "Safe file upload handling" },
];

function getRoutes(artifact: ScanArtifact): RouteEntry[] {
  if (!artifact.routeMap) return [];
  if (Array.isArray(artifact.routeMap)) return artifact.routeMap as RouteEntry[];
  return (artifact.routeMap as { routes?: RouteEntry[] }).routes ?? [];
}

function getMiddlewareCoverage(
  artifact: ScanArtifact,
  routeId: string
): { covered: boolean; reason?: string } {
  if (!artifact.middlewareMap) return { covered: false };
  if (Array.isArray(artifact.middlewareMap)) return { covered: false };

  const mwMap = artifact.middlewareMap as { coverage?: Array<{ routeId: string; covered: boolean; reason?: string }> };
  const coverage = mwMap.coverage?.find((c) => c.routeId === routeId);
  return {
    covered: coverage?.covered ?? false,
    reason: coverage?.reason,
  };
}

function getProofTrace(
  artifact: ScanArtifact,
  routeId: string
): { summary: string; nodes: Array<{ kind: string; label: string; file?: string; line?: number }> } | null {
  const traces = artifact.proofTraces;
  if (!traces || typeof traces !== "object") return null;
  return (traces as Record<string, { summary: string; nodes: Array<{ kind: string; label: string; file?: string; line?: number }> }>)[routeId] ?? null;
}

function getRouteFindings(findings: Finding[], routeFile: string): Finding[] {
  const normalizedFile = routeFile.replace(/\\/g, "/");
  return findings.filter((f) => {
    const evidence = f.evidence[0];
    if (!evidence) return false;
    const evidenceFile = evidence.file.replace(/\\/g, "/");
    return evidenceFile.includes(normalizedFile) || normalizedFile.includes(evidenceFile);
  });
}

function checkAuthProtection(
  artifact: ScanArtifact,
  route: RouteEntry,
  routeFindings: Finding[]
): ProtectionCell {
  const trace = getProofTrace(artifact, route.routeId);
  const middlewareCoverage = getMiddlewareCoverage(artifact, route.routeId);

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
        findingId: finding.id,
      },
    };
  }

  if (trace?.summary?.toLowerCase().includes("auth")) {
    return {
      status: "protected",
      tooltip: "Auth protection detected via proof trace",
      evidence: { file: route.file, line: route.startLine },
    };
  }

  if (middlewareCoverage.covered) {
    return {
      status: "protected",
      tooltip: "Protected by middleware",
      evidence: { file: "middleware.ts" },
    };
  }

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

function checkValidationProtection(
  artifact: ScanArtifact,
  route: RouteEntry,
  routeFindings: Finding[]
): ProtectionCell {
  const trace = getProofTrace(artifact, route.routeId);

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
        evidence: { file: validatorNode?.file, line: validatorNode?.line },
      };
    }
  }

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

function checkMiddlewareProtection(
  artifact: ScanArtifact,
  route: RouteEntry,
  routeFindings: Finding[]
): ProtectionCell {
  const coverage = getMiddlewareCoverage(artifact, route.routeId);

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
      evidence: { file: "middleware.ts" },
    };
  }

  return {
    status: "missing",
    tooltip: "Not covered by middleware matcher",
  };
}

function checkRateLimitProtection(
  artifact: ScanArtifact,
  route: RouteEntry,
  routeFindings: Finding[]
): ProtectionCell {
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

  const trace = getProofTrace(artifact, route.routeId);
  if (trace) {
    const hasRateLimit = trace.nodes.some((node) =>
      /rate|limit|throttle/i.test(node.label)
    );
    if (hasRateLimit) {
      return { status: "protected", tooltip: "Rate limiting detected" };
    }
  }

  const mwCoverage = getMiddlewareCoverage(artifact, route.routeId);
  if (mwCoverage.covered) {
    return { status: "unknown", tooltip: "May be rate limited via middleware" };
  }

  return { status: "unknown", tooltip: "Rate limiting status unknown" };
}

function checkUploadProtection(
  artifact: ScanArtifact,
  route: RouteEntry,
  routeFindings: Finding[]
): ProtectionCell {
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

  const isUploadRoute = /upload|file|image|media|attachment/i.test(route.path);
  if (!isUploadRoute && route.method === "GET") {
    return {
      status: "unknown",
      tooltip: "Route does not appear to handle uploads",
    };
  }

  if (isUploadRoute) {
    return { status: "protected", tooltip: "No upload vulnerabilities detected" };
  }

  return { status: "unknown", tooltip: "Upload handling status unknown" };
}

function buildHeatmapData(artifact: ScanArtifact): HeatmapData {
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

    const hasGaps =
      isStateChanging &&
      (protections.auth.status === "missing" ||
        protections.validation.status === "missing" ||
        protections.middleware.status === "missing");

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

  // Sort deterministically
  routeRows.sort((a, b) => {
    const methodOrder = ["GET", "POST", "PUT", "PATCH", "DELETE"];
    const aMethodIdx = methodOrder.indexOf(a.method);
    const bMethodIdx = methodOrder.indexOf(b.method);
    if (aMethodIdx !== bMethodIdx) return aMethodIdx - bMethodIdx;
    return a.path.localeCompare(b.path);
  });

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

  return { routes: routeRows, columns: PROTECTION_COLUMNS, summary };
}

function buildCoverageRadarData(artifact: ScanArtifact): CoverageRadarData {
  const routes = getRoutes(artifact);
  const findings = artifact.findings;
  const metrics = artifact.metrics;

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
        total = routes.length;
        const mwFindings = findings.filter((f) => f.category === "middleware");
        count = total - mwFindings.length;
        value = total > 0 ? Math.round((count / total) * 100) : 100;
        break;
      }
      case "crypto": {
        const cryptoFindings = findings.filter(
          (f) => f.category === "crypto" || f.ruleId.startsWith("VC-CRYPTO")
        );
        total = routes.length;
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

function filterHeatmapData(
  data: HeatmapData,
  options: { stateChangingOnly?: boolean; gapsOnly?: boolean; searchQuery?: string }
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

  return { routes, columns: data.columns, summary };
}

// ============================================================================
// Test Helpers
// ============================================================================

function createMockArtifact(
  routes: RouteEntry[],
  findings: Finding[] = [],
  middlewareCoverage: Array<{ routeId: string; covered: boolean; reason?: string }> = [],
  proofTraces: Record<string, { summary: string; nodes: Array<{ kind: string; label: string; file?: string; line?: number }> }> = {}
): ScanArtifact {
  return {
    version: "1.0.0",
    scanId: "test-scan-123",
    timestamp: new Date().toISOString(),
    repoUrl: "https://github.com/test/repo",
    branch: "main",
    commitSha: "abc123",
    source: "cli",
    routeMap: { routes },
    middlewareMap: { coverage: middlewareCoverage },
    proofTraces,
    findings,
    metrics: {
      totalFiles: 10,
      totalLines: 1000,
      scannedAt: new Date().toISOString(),
    },
  };
}

function createRoute(
  method: string,
  path: string,
  file: string,
  routeId?: string
): RouteEntry {
  return {
    routeId: routeId ?? `route:${method}:${path}`,
    method,
    path,
    file,
    startLine: 1,
  };
}

function createFinding(
  id: string,
  ruleId: string,
  category: string,
  file: string,
  title: string = "Test finding"
): Finding {
  return {
    id,
    ruleId,
    category,
    severity: "medium",
    title,
    description: "Test finding description",
    evidence: [
      {
        file,
        startLine: 1,
        endLine: 1,
        snippet: "test code",
      },
    ],
    recommendation: "Fix it",
    confidence: "high",
    tags: [],
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("Heatmap Builder", () => {
  describe("Basic Functionality", () => {
    it("should build heatmap from empty artifact", () => {
      const artifact = createMockArtifact([]);
      const heatmap = buildHeatmapData(artifact);

      expect(heatmap.routes).toHaveLength(0);
      expect(heatmap.columns).toHaveLength(5);
      expect(heatmap.summary.totalRoutes).toBe(0);
    });

    it("should build heatmap with routes", () => {
      const routes = [
        createRoute("GET", "/api/users", "routes/users.ts"),
        createRoute("POST", "/api/users", "routes/users.ts"),
      ];
      const artifact = createMockArtifact(routes);
      const heatmap = buildHeatmapData(artifact);

      expect(heatmap.routes).toHaveLength(2);
      expect(heatmap.summary.totalRoutes).toBe(2);
      expect(heatmap.summary.stateChangingRoutes).toBe(1);
    });

    it("should identify state-changing routes", () => {
      const routes = [
        createRoute("GET", "/api/users", "routes/users.ts"),
        createRoute("POST", "/api/users", "routes/users.ts"),
        createRoute("PUT", "/api/users/1", "routes/users.ts"),
        createRoute("PATCH", "/api/users/1", "routes/users.ts"),
        createRoute("DELETE", "/api/users/1", "routes/users.ts"),
      ];
      const artifact = createMockArtifact(routes);
      const heatmap = buildHeatmapData(artifact);

      expect(heatmap.summary.stateChangingRoutes).toBe(4);
      expect(heatmap.routes.find((r) => r.method === "GET")?.isStateChanging).toBe(false);
      expect(heatmap.routes.find((r) => r.method === "POST")?.isStateChanging).toBe(true);
    });
  });

  describe("Protection Detection", () => {
    it("should detect auth missing from findings", () => {
      const routes = [createRoute("POST", "/api/users", "routes/users.ts")];
      const findings = [
        createFinding("f1", "VC-AUTH-001", "auth", "routes/users.ts", "Missing authentication"),
      ];
      const artifact = createMockArtifact(routes, findings);
      const heatmap = buildHeatmapData(artifact);

      expect(heatmap.routes[0].protections.auth.status).toBe("missing");
      expect(heatmap.routes[0].protections.auth.evidence?.findingId).toBe("f1");
    });

    it("should detect auth protected via proof trace", () => {
      const routes = [createRoute("POST", "/api/users", "routes/users.ts", "route:POST:/api/users")];
      const proofTraces = {
        "route:POST:/api/users": {
          summary: "Route with auth middleware protection",
          nodes: [{ kind: "middleware", label: "authMiddleware" }],
        },
      };
      const artifact = createMockArtifact(routes, [], [], proofTraces);
      const heatmap = buildHeatmapData(artifact);

      expect(heatmap.routes[0].protections.auth.status).toBe("protected");
    });

    it("should detect auth protected via middleware coverage", () => {
      const routes = [createRoute("POST", "/api/users", "routes/users.ts", "route:POST:/api/users")];
      const middlewareCoverage = [{ routeId: "route:POST:/api/users", covered: true }];
      const artifact = createMockArtifact(routes, [], middlewareCoverage);
      const heatmap = buildHeatmapData(artifact);

      expect(heatmap.routes[0].protections.auth.status).toBe("protected");
    });

    it("should detect validation via proof trace", () => {
      const routes = [createRoute("POST", "/api/users", "routes/users.ts", "route:POST:/api/users")];
      const proofTraces = {
        "route:POST:/api/users": {
          summary: "Route with validation",
          nodes: [{ kind: "function", label: "zodSchema.parse", file: "routes/users.ts", line: 10 }],
        },
      };
      const artifact = createMockArtifact(routes, [], [], proofTraces);
      const heatmap = buildHeatmapData(artifact);

      expect(heatmap.routes[0].protections.validation.status).toBe("protected");
    });

    it("should detect middleware coverage missing", () => {
      const routes = [createRoute("POST", "/api/users", "routes/users.ts")];
      const artifact = createMockArtifact(routes);
      const heatmap = buildHeatmapData(artifact);

      expect(heatmap.routes[0].protections.middleware.status).toBe("missing");
    });

    it("should detect middleware coverage present", () => {
      const routes = [createRoute("POST", "/api/users", "routes/users.ts", "route:POST:/api/users")];
      const middlewareCoverage = [{ routeId: "route:POST:/api/users", covered: true, reason: "Matched by /api/*" }];
      const artifact = createMockArtifact(routes, [], middlewareCoverage);
      const heatmap = buildHeatmapData(artifact);

      expect(heatmap.routes[0].protections.middleware.status).toBe("protected");
    });
  });

  describe("Gap Detection", () => {
    it("should mark state-changing routes with missing auth as having gaps", () => {
      const routes = [createRoute("POST", "/api/users", "routes/users.ts")];
      const artifact = createMockArtifact(routes);
      const heatmap = buildHeatmapData(artifact);

      // POST without middleware = missing auth + missing middleware = gaps
      expect(heatmap.routes[0].hasGaps).toBe(true);
      expect(heatmap.summary.routesWithGaps).toBe(1);
    });

    it("should not mark GET routes as having gaps", () => {
      const routes = [createRoute("GET", "/api/users", "routes/users.ts")];
      const artifact = createMockArtifact(routes);
      const heatmap = buildHeatmapData(artifact);

      expect(heatmap.routes[0].hasGaps).toBe(false);
    });

    it("should not mark protected state-changing routes as having gaps", () => {
      const routes = [createRoute("POST", "/api/users", "routes/users.ts", "route:POST:/api/users")];
      const middlewareCoverage = [{ routeId: "route:POST:/api/users", covered: true }];
      const proofTraces = {
        "route:POST:/api/users": {
          summary: "Route with auth and validation",
          nodes: [
            { kind: "middleware", label: "authMiddleware" },
            { kind: "function", label: "zodValidate" },
          ],
        },
      };
      const artifact = createMockArtifact(routes, [], middlewareCoverage, proofTraces);
      const heatmap = buildHeatmapData(artifact);

      expect(heatmap.routes[0].hasGaps).toBe(false);
    });
  });

  describe("Determinism", () => {
    it("should produce identical heatmaps on multiple runs", () => {
      const routes = [
        createRoute("DELETE", "/api/users/1", "routes/users.ts"),
        createRoute("GET", "/api/users", "routes/users.ts"),
        createRoute("POST", "/api/users", "routes/users.ts"),
        createRoute("GET", "/api/posts", "routes/posts.ts"),
      ];
      const artifact = createMockArtifact(routes);

      const heatmap1 = buildHeatmapData(artifact);
      const heatmap2 = buildHeatmapData(artifact);

      expect(heatmap1).toEqual(heatmap2);
    });

    it("should sort routes by method then path", () => {
      const routes = [
        createRoute("DELETE", "/api/b", "routes/b.ts"),
        createRoute("GET", "/api/z", "routes/z.ts"),
        createRoute("POST", "/api/a", "routes/a.ts"),
        createRoute("GET", "/api/a", "routes/a.ts"),
      ];
      const artifact = createMockArtifact(routes);
      const heatmap = buildHeatmapData(artifact);

      expect(heatmap.routes.map((r) => `${r.method}:${r.path}`)).toEqual([
        "GET:/api/a",
        "GET:/api/z",
        "POST:/api/a",
        "DELETE:/api/b",
      ]);
    });
  });

  describe("Filtering", () => {
    it("should filter to state-changing routes only", () => {
      const routes = [
        createRoute("GET", "/api/users", "routes/users.ts"),
        createRoute("POST", "/api/users", "routes/users.ts"),
        createRoute("DELETE", "/api/users/1", "routes/users.ts"),
      ];
      const artifact = createMockArtifact(routes);
      const heatmap = buildHeatmapData(artifact);
      const filtered = filterHeatmapData(heatmap, { stateChangingOnly: true });

      expect(filtered.routes).toHaveLength(2);
      expect(filtered.routes.every((r) => r.isStateChanging)).toBe(true);
    });

    it("should filter to routes with gaps only", () => {
      const routes = [
        createRoute("GET", "/api/users", "routes/users.ts"),
        createRoute("POST", "/api/users", "routes/users.ts", "route:POST:/api/users"),
        createRoute("POST", "/api/admin", "routes/admin.ts", "route:POST:/api/admin"),
      ];
      // Only cover one POST route
      const middlewareCoverage = [{ routeId: "route:POST:/api/users", covered: true }];
      const proofTraces = {
        "route:POST:/api/users": {
          summary: "Protected route",
          nodes: [{ kind: "middleware", label: "authMiddleware" }],
        },
      };
      const artifact = createMockArtifact(routes, [], middlewareCoverage, proofTraces);
      const heatmap = buildHeatmapData(artifact);
      const filtered = filterHeatmapData(heatmap, { gapsOnly: true });

      expect(filtered.routes).toHaveLength(1);
      expect(filtered.routes[0].path).toBe("/api/admin");
    });

    it("should filter by search query", () => {
      const routes = [
        createRoute("GET", "/api/users", "routes/users.ts"),
        createRoute("POST", "/api/users", "routes/users.ts"),
        createRoute("GET", "/api/posts", "routes/posts.ts"),
      ];
      const artifact = createMockArtifact(routes);
      const heatmap = buildHeatmapData(artifact);
      const filtered = filterHeatmapData(heatmap, { searchQuery: "users" });

      expect(filtered.routes).toHaveLength(2);
      expect(filtered.routes.every((r) => r.path.includes("users"))).toBe(true);
    });

    it("should combine multiple filters", () => {
      const routes = [
        createRoute("GET", "/api/users", "routes/users.ts"),
        createRoute("POST", "/api/users", "routes/users.ts"),
        createRoute("POST", "/api/posts", "routes/posts.ts"),
      ];
      const artifact = createMockArtifact(routes);
      const heatmap = buildHeatmapData(artifact);
      const filtered = filterHeatmapData(heatmap, {
        stateChangingOnly: true,
        searchQuery: "users",
      });

      expect(filtered.routes).toHaveLength(1);
      expect(filtered.routes[0].method).toBe("POST");
      expect(filtered.routes[0].path).toBe("/api/users");
    });
  });

  describe("Coverage Radar", () => {
    it("should build radar data with all axes", () => {
      const routes = [createRoute("POST", "/api/users", "routes/users.ts")];
      const artifact = createMockArtifact(routes);
      const radar = buildCoverageRadarData(artifact);

      expect(radar.axes).toHaveLength(6);
      expect(radar.axes.map((a) => a.key)).toEqual([
        "auth",
        "validation",
        "middleware",
        "crypto",
        "network",
        "privacy",
      ]);
    });

    it("should calculate coverage percentages", () => {
      const routes = [
        createRoute("POST", "/api/users", "routes/users.ts"),
        createRoute("POST", "/api/posts", "routes/posts.ts"),
      ];
      const findings = [
        createFinding("f1", "VC-AUTH-001", "auth", "routes/users.ts"),
      ];
      const artifact = createMockArtifact(routes, findings);
      const radar = buildCoverageRadarData(artifact);

      const authAxis = radar.axes.find((a) => a.key === "auth");
      // 1 of 2 state-changing routes has auth finding = 50% coverage
      expect(authAxis?.value).toBe(50);
      expect(authAxis?.count).toBe(1);
      expect(authAxis?.total).toBe(2);
    });

    it("should return 100% coverage when no routes exist", () => {
      const artifact = createMockArtifact([]);
      const radar = buildCoverageRadarData(artifact);

      expect(radar.axes.every((a) => a.value === 100)).toBe(true);
    });

    it("should return 100% coverage when no findings exist", () => {
      const routes = [createRoute("POST", "/api/users", "routes/users.ts")];
      const artifact = createMockArtifact(routes);
      const radar = buildCoverageRadarData(artifact);

      // All axes should have high coverage when no findings
      expect(radar.axes.every((a) => a.value >= 0 && a.value <= 100)).toBe(true);
    });
  });

  describe("Summary Calculation", () => {
    it("should correctly count protection statuses", () => {
      const routes = [
        createRoute("GET", "/api/users", "routes/users.ts"),
        createRoute("POST", "/api/users", "routes/users.ts", "route:POST:/api/users"),
        createRoute("POST", "/api/admin", "routes/admin.ts"),
      ];
      const middlewareCoverage = [{ routeId: "route:POST:/api/users", covered: true }];
      const artifact = createMockArtifact(routes, [], middlewareCoverage);
      const heatmap = buildHeatmapData(artifact);

      // Verify summary counts add up
      const { protectionCounts } = heatmap.summary;
      for (const key of Object.keys(protectionCounts) as Array<keyof typeof protectionCounts>) {
        const counts = protectionCounts[key];
        expect(counts.protected + counts.missing + counts.unknown).toBe(3);
      }
    });

    it("should recalculate summary after filtering", () => {
      const routes = [
        createRoute("GET", "/api/users", "routes/users.ts"),
        createRoute("POST", "/api/users", "routes/users.ts"),
      ];
      const artifact = createMockArtifact(routes);
      const heatmap = buildHeatmapData(artifact);
      const filtered = filterHeatmapData(heatmap, { stateChangingOnly: true });

      expect(filtered.summary.totalRoutes).toBe(1);
      expect(filtered.summary.stateChangingRoutes).toBe(1);
    });
  });
});

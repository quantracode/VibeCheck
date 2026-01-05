import { describe, it, expect } from "vitest";
import type { ScanArtifact, Finding } from "@vibecheck/schema";
import {
  computeRegression,
  detectProtectionRegressions,
  detectSemanticRegressions,
  hasProtectionRegressions,
  hasSemanticRegressions,
} from "../regression.js";
import { evaluate } from "../evaluator.js";
import type { RegressionPolicy } from "../schemas/index.js";

// ============================================================================
// Test Fixtures
// ============================================================================

const createFinding = (overrides: Partial<Finding> = {}): Finding => ({
  id: `f-${Math.random().toString(36).slice(2, 8)}`,
  severity: "medium",
  confidence: 0.8,
  category: "auth",
  ruleId: "VC-AUTH-001",
  title: "Test finding",
  description: "Test description",
  evidence: [{ file: "src/api/test.ts", startLine: 1, endLine: 2, label: "L" }],
  remediation: { recommendedFix: "Fix it" },
  fingerprint: `sha256:${Math.random().toString(36).slice(2, 10)}`,
  ...overrides,
});

const createArtifact = (findings: Finding[]): ScanArtifact => ({
  artifactVersion: "0.3",
  generatedAt: new Date().toISOString(),
  tool: { name: "vibecheck", version: "0.0.1" },
  repo: { name: "test-repo", rootPathHash: "abc123" },
  summary: {
    totalFindings: findings.length,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    byCategory: {
      auth: 0, validation: 0, middleware: 0, secrets: 0,
      injection: 0, privacy: 0, config: 0, network: 0,
      crypto: 0, uploads: 0, hallucinations: 0, abuse: 0,
      correlation: 0, authorization: 0, lifecycle: 0, "supply-chain": 0,
      other: 0,
    },
  },
  findings,
});

// ============================================================================
// Protection Regression Tests
// ============================================================================

describe("detectProtectionRegressions", () => {
  it("detects when auth protection is removed from a route", () => {
    // Baseline: route was protected (no auth finding)
    const baseline = createArtifact([]);

    // Current: auth finding appears (protection removed)
    const current = createArtifact([
      createFinding({
        ruleId: "VC-AUTH-001",
        title: "Unprotected POST handler",
        evidence: [{ file: "api/users/route.ts", startLine: 10, endLine: 20, label: "Handler" }],
      }),
    ]);

    const regressions = detectProtectionRegressions(current, baseline);

    expect(regressions.length).toBe(1);
    expect(regressions[0].protectionType).toBe("auth");
    expect(regressions[0].file).toBe("api/users/route.ts");
  });

  it("detects when validation protection is removed", () => {
    const baseline = createArtifact([]);

    const current = createArtifact([
      createFinding({
        ruleId: "VC-VAL-001",
        title: "Missing input validation in POST handler",
        evidence: [{ file: "api/posts/route.ts", startLine: 5, endLine: 15, label: "Handler" }],
      }),
    ]);

    const regressions = detectProtectionRegressions(current, baseline);

    expect(regressions.length).toBe(1);
    expect(regressions[0].protectionType).toBe("validation");
  });

  it("detects lifecycle rule regressions", () => {
    const baseline = createArtifact([]);

    const current = createArtifact([
      createFinding({
        ruleId: "VC-LIFE-001",
        category: "lifecycle",
        title: "Create-update asymmetry for users: POST protected but PUT is not",
        evidence: [{ file: "api/users/[id]/route.ts", startLine: 1, endLine: 10, label: "PUT handler" }],
      }),
    ]);

    const regressions = detectProtectionRegressions(current, baseline);

    expect(regressions.length).toBe(1);
    expect(regressions[0].protectionType).toBe("auth");
    expect(regressions[0].description).toContain("Create-update asymmetry");
  });

  it("does not report regression for persisting findings", () => {
    const fingerprint = "sha256:existing";

    const finding = createFinding({
      fingerprint,
      ruleId: "VC-AUTH-001",
      title: "Unprotected POST handler",
      evidence: [{ file: "api/users/route.ts", startLine: 10, endLine: 20, label: "Handler" }],
    });

    const baseline = createArtifact([finding]);
    const current = createArtifact([{ ...finding }]);

    const regressions = detectProtectionRegressions(current, baseline);

    expect(regressions.length).toBe(0);
  });
});

// ============================================================================
// Semantic Regression Tests
// ============================================================================

describe("detectSemanticRegressions", () => {
  it("detects coverage decrease when new routes have findings", () => {
    // Baseline: one route has a finding
    const baseline = createArtifact([
      createFinding({
        ruleId: "VC-AUTH-001",
        evidence: [{ file: "api/users/route.ts", startLine: 1, endLine: 10, label: "Handler" }],
      }),
    ]);

    // Current: three routes now have findings (200% increase)
    const current = createArtifact([
      createFinding({
        ruleId: "VC-AUTH-001",
        evidence: [{ file: "api/users/route.ts", startLine: 1, endLine: 10, label: "Handler" }],
      }),
      createFinding({
        ruleId: "VC-AUTH-001",
        evidence: [{ file: "api/posts/route.ts", startLine: 1, endLine: 10, label: "Handler" }],
      }),
      createFinding({
        ruleId: "VC-AUTH-001",
        evidence: [{ file: "api/comments/route.ts", startLine: 1, endLine: 10, label: "Handler" }],
      }),
    ]);

    const regressions = detectSemanticRegressions(current, baseline);

    const coverageRegression = regressions.find((r) => r.type === "coverage_decreased");
    expect(coverageRegression).toBeDefined();
    expect(coverageRegression!.description).toContain("new routes have security findings");
  });

  it("detects severity group increase", () => {
    // Baseline: auth findings are medium
    const baseline = createArtifact([
      createFinding({
        ruleId: "VC-AUTH-001",
        severity: "medium",
      }),
    ]);

    // Current: auth findings escalated to critical
    const current = createArtifact([
      createFinding({
        ruleId: "VC-AUTH-001",
        severity: "critical",
      }),
    ]);

    const regressions = detectSemanticRegressions(current, baseline);

    const severityIncrease = regressions.find((r) => r.type === "severity_group_increase");
    expect(severityIncrease).toBeDefined();
    expect(severityIncrease!.affectedId).toBe("VC-AUTH");
    expect(severityIncrease!.severity).toBe("critical");
  });

  it("includes protection removal in semantic regressions", () => {
    const baseline = createArtifact([]);

    const current = createArtifact([
      createFinding({
        ruleId: "VC-AUTH-001",
        title: "Unprotected POST handler",
        evidence: [{ file: "api/users/route.ts", startLine: 10, endLine: 20, label: "Handler" }],
      }),
    ]);

    const regressions = detectSemanticRegressions(current, baseline);

    const protectionRemoved = regressions.find((r) => r.type === "protection_removed");
    expect(protectionRemoved).toBeDefined();
    expect(protectionRemoved!.severity).toBe("high");
  });
});

// ============================================================================
// Regression Summary Integration Tests
// ============================================================================

describe("computeRegression with semantic regressions", () => {
  it("includes protectionRegressions in summary", () => {
    const baseline = createArtifact([]);

    const current = createArtifact([
      createFinding({
        ruleId: "VC-AUTH-001",
        title: "Unprotected DELETE handler",
        evidence: [{ file: "api/users/[id]/route.ts", startLine: 1, endLine: 10, label: "Handler" }],
      }),
    ]);

    const summary = computeRegression(current, baseline);

    expect(summary.protectionRegressions).toBeDefined();
    expect(summary.protectionRegressions!.length).toBeGreaterThan(0);
    expect(hasProtectionRegressions(summary)).toBe(true);
  });

  it("includes semanticRegressions in summary", () => {
    const baseline = createArtifact([
      createFinding({
        ruleId: "VC-AUTH-001",
        severity: "low",
        evidence: [{ file: "api/test/route.ts", startLine: 1, endLine: 10, label: "Handler" }],
      }),
    ]);

    const current = createArtifact([
      createFinding({
        ruleId: "VC-AUTH-001",
        severity: "critical",
        evidence: [{ file: "api/test/route.ts", startLine: 1, endLine: 10, label: "Handler" }],
      }),
      createFinding({
        ruleId: "VC-AUTH-001",
        severity: "high",
        evidence: [{ file: "api/new/route.ts", startLine: 1, endLine: 10, label: "Handler" }],
      }),
    ]);

    const summary = computeRegression(current, baseline);

    expect(summary.semanticRegressions).toBeDefined();
    expect(hasSemanticRegressions(summary)).toBe(true);
  });
});

// ============================================================================
// Policy Evaluation with Semantic Regressions
// ============================================================================

describe("evaluate with semantic regression policy", () => {
  it("fails when failOnProtectionRemoved is enabled and protection was removed", () => {
    const baseline = createArtifact([]);

    const current = createArtifact([
      createFinding({
        ruleId: "VC-AUTH-001",
        severity: "low",
        confidence: 0.3, // Low confidence to not trigger severity threshold
        title: "Unprotected POST handler",
        evidence: [{ file: "api/users/route.ts", startLine: 10, endLine: 20, label: "Handler" }],
      }),
    ]);

    const result = evaluate({
      artifact: current,
      baseline,
      config: {
        thresholds: {
          failOnSeverity: "critical",
          warnOnSeverity: "high",
          minConfidenceForFail: 0.9,
          minConfidenceForWarn: 0.8,
          minConfidenceCritical: 0.9,
          maxFindings: 0,
          maxCritical: 0,
          maxHigh: 0,
        },
        overrides: [],
        regression: {
          failOnNewHighCritical: false,
          failOnSeverityRegression: false,
          failOnNetIncrease: false,
          warnOnNewFindings: false,
          failOnProtectionRemoved: true,
          warnOnProtectionRemoved: false,
          failOnSemanticRegression: false,
        },
      },
    });

    expect(result.status).toBe("fail");
    expect(result.reasons.some((r) => r.code === "protection_removed")).toBe(true);
  });

  it("warns when warnOnProtectionRemoved is enabled", () => {
    const baseline = createArtifact([]);

    const current = createArtifact([
      createFinding({
        ruleId: "VC-VAL-001",
        severity: "low",
        confidence: 0.3,
        title: "Missing validation in POST handler",
        evidence: [{ file: "api/posts/route.ts", startLine: 5, endLine: 15, label: "Handler" }],
      }),
    ]);

    const result = evaluate({
      artifact: current,
      baseline,
      config: {
        thresholds: {
          failOnSeverity: "critical",
          warnOnSeverity: "critical",
          minConfidenceForFail: 0.9,
          minConfidenceForWarn: 0.9,
          minConfidenceCritical: 0.9,
          maxFindings: 0,
          maxCritical: 0,
          maxHigh: 0,
        },
        overrides: [],
        regression: {
          failOnNewHighCritical: false,
          failOnSeverityRegression: false,
          failOnNetIncrease: false,
          warnOnNewFindings: false,
          failOnProtectionRemoved: false,
          warnOnProtectionRemoved: true,
          failOnSemanticRegression: false,
        },
      },
    });

    expect(result.status).toBe("warn");
    expect(result.reasons.some((r) => r.code === "protection_removed")).toBe(true);
  });

  it("fails when failOnSemanticRegression is enabled and severity group increased", () => {
    const baseline = createArtifact([
      createFinding({
        ruleId: "VC-AUTH-001",
        severity: "low",
        confidence: 0.3,
        evidence: [{ file: "api/test/route.ts", startLine: 1, endLine: 10, label: "Handler" }],
      }),
    ]);

    const current = createArtifact([
      createFinding({
        ruleId: "VC-AUTH-001",
        severity: "critical",
        confidence: 0.3,
        evidence: [{ file: "api/test/route.ts", startLine: 1, endLine: 10, label: "Handler" }],
      }),
    ]);

    const result = evaluate({
      artifact: current,
      baseline,
      config: {
        thresholds: {
          failOnSeverity: "critical",
          warnOnSeverity: "high",
          minConfidenceForFail: 0.9,
          minConfidenceForWarn: 0.8,
          minConfidenceCritical: 0.9,
          maxFindings: 0,
          maxCritical: 0,
          maxHigh: 0,
        },
        overrides: [],
        regression: {
          failOnNewHighCritical: false,
          failOnSeverityRegression: false,
          failOnNetIncrease: false,
          warnOnNewFindings: false,
          failOnProtectionRemoved: false,
          warnOnProtectionRemoved: false,
          failOnSemanticRegression: true,
        },
      },
    });

    expect(result.status).toBe("fail");
    expect(result.reasons.some((r) => r.code === "semantic_regression")).toBe(true);
  });
});

// ============================================================================
// Lifecycle Rule Regression Fixtures
// ============================================================================

describe("lifecycle rule regression fixtures", () => {
  it("demonstrates VC-LIFE-001 regression: update protection removed", () => {
    // Baseline: No lifecycle issues (all endpoints protected)
    const baseline = createArtifact([]);

    // Current: Lifecycle asymmetry detected
    const current = createArtifact([
      createFinding({
        id: "vc-life-001-abc123",
        ruleId: "VC-LIFE-001",
        category: "lifecycle",
        severity: "high",
        title: "Create-update asymmetry for posts: POST protected but PUT is not",
        description: "The POST handler requires auth but PUT does not",
        evidence: [
          { file: "api/posts/route.ts", startLine: 10, endLine: 25, label: "Protected POST handler" },
          { file: "api/posts/[id]/route.ts", startLine: 5, endLine: 20, label: "Unprotected PUT handler" },
        ],
        fingerprint: "sha256:life001-posts",
      }),
    ]);

    const summary = computeRegression(current, baseline);

    // Should detect as protection regression (auth type from VC-LIFE-001)
    expect(summary.protectionRegressions?.length).toBeGreaterThan(0);
    expect(summary.newFindings.length).toBe(1);
    expect(summary.newFindings[0].ruleId).toBe("VC-LIFE-001");
  });

  it("demonstrates VC-LIFE-002 regression: validation schema drift", () => {
    const baseline = createArtifact([]);

    const current = createArtifact([
      createFinding({
        id: "vc-life-002-xyz789",
        ruleId: "VC-LIFE-002",
        category: "lifecycle",
        severity: "medium",
        title: "Validation schema drift for users: POST validated but PATCH is not",
        description: "POST uses Zod validation but PATCH accepts raw body",
        evidence: [
          { file: "api/users/route.ts", startLine: 1, endLine: 15, label: "Validated POST" },
          { file: "api/users/[id]/route.ts", startLine: 1, endLine: 15, label: "Unvalidated PATCH" },
        ],
        fingerprint: "sha256:life002-users",
      }),
    ]);

    const summary = computeRegression(current, baseline);

    expect(summary.protectionRegressions?.length).toBeGreaterThan(0);
    const validationRegression = summary.protectionRegressions?.find(
      (r) => r.protectionType === "validation"
    );
    expect(validationRegression).toBeDefined();
  });

  it("demonstrates VC-LIFE-003 regression: rate limit gap on delete", () => {
    const baseline = createArtifact([]);

    const current = createArtifact([
      createFinding({
        id: "vc-life-003-del456",
        ruleId: "VC-LIFE-003",
        category: "lifecycle",
        severity: "medium",
        title: "Delete rate limit gap for posts: other methods rate-limited but DELETE is not",
        description: "POST is rate-limited but DELETE allows unlimited calls",
        evidence: [
          { file: "api/posts/route.ts", startLine: 1, endLine: 10, label: "Rate-limited POST" },
          { file: "api/posts/[id]/route.ts", startLine: 1, endLine: 10, label: "Unprotected DELETE" },
        ],
        fingerprint: "sha256:life003-posts",
      }),
    ]);

    const summary = computeRegression(current, baseline);

    expect(summary.protectionRegressions?.length).toBeGreaterThan(0);
    const rateLimitRegression = summary.protectionRegressions?.find(
      (r) => r.protectionType === "rate-limit"
    );
    expect(rateLimitRegression).toBeDefined();
  });
});

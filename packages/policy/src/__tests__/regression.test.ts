import { describe, it, expect } from "vitest";
import type { ScanArtifact, Finding } from "@vibecheck/schema";
import {
  computeRegression,
  isSeverityRegression,
  hasNewHighCritical,
  getNewHighCriticalIds,
  hasSeverityRegressions,
  hasNetIncrease,
} from "../regression.js";

// Test fixtures
const createFinding = (overrides: Partial<Finding>): Finding => ({
  id: `f-${Math.random().toString(36).slice(2, 8)}`,
  severity: "medium",
  confidence: 0.8,
  category: "auth",
  ruleId: "VC-AUTH-001",
  title: "Test finding",
  description: "Test description",
  evidence: [{ file: "test.ts", startLine: 1, endLine: 2, label: "L" }],
  remediation: { recommendedFix: "Fix it" },
  fingerprint: `sha256:${Math.random().toString(36).slice(2, 10)}`,
  ...overrides,
});

const createArtifact = (findings: Finding[]): ScanArtifact => ({
  artifactVersion: "0.2",
  generatedAt: new Date().toISOString(),
  tool: { name: "vibecheck", version: "0.0.1" },
  repo: { name: "test-repo", rootPathHash: "abc123" },
  summary: {
    totalFindings: findings.length,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    byCategory: {} as any,
  },
  findings,
});

describe("isSeverityRegression", () => {
  it("returns true when severity increased", () => {
    expect(isSeverityRegression("critical", "high")).toBe(true);
    expect(isSeverityRegression("high", "medium")).toBe(true);
    expect(isSeverityRegression("medium", "low")).toBe(true);
  });

  it("returns false when severity decreased or same", () => {
    expect(isSeverityRegression("high", "critical")).toBe(false);
    expect(isSeverityRegression("medium", "high")).toBe(false);
    expect(isSeverityRegression("high", "high")).toBe(false);
  });
});

describe("computeRegression", () => {
  it("identifies new findings", () => {
    const baseline = createArtifact([
      createFinding({ fingerprint: "sha256:existing" }),
    ]);
    const current = createArtifact([
      createFinding({ fingerprint: "sha256:existing" }),
      createFinding({ id: "new-1", fingerprint: "sha256:new1", severity: "high" }),
    ]);

    const result = computeRegression(current, baseline);
    expect(result.newFindings).toHaveLength(1);
    expect(result.newFindings[0].fingerprint).toBe("sha256:new1");
    expect(result.newFindings[0].severity).toBe("high");
  });

  it("identifies resolved findings", () => {
    const baseline = createArtifact([
      createFinding({ fingerprint: "sha256:resolved" }),
      createFinding({ fingerprint: "sha256:existing" }),
    ]);
    const current = createArtifact([
      createFinding({ fingerprint: "sha256:existing" }),
    ]);

    const result = computeRegression(current, baseline);
    expect(result.resolvedFindings).toHaveLength(1);
    expect(result.resolvedFindings[0].fingerprint).toBe("sha256:resolved");
  });

  it("counts persisting findings", () => {
    const baseline = createArtifact([
      createFinding({ fingerprint: "sha256:a" }),
      createFinding({ fingerprint: "sha256:b" }),
    ]);
    const current = createArtifact([
      createFinding({ fingerprint: "sha256:a" }),
      createFinding({ fingerprint: "sha256:b" }),
    ]);

    const result = computeRegression(current, baseline);
    expect(result.persistingCount).toBe(2);
    expect(result.newFindings).toHaveLength(0);
    expect(result.resolvedFindings).toHaveLength(0);
  });

  it("detects severity regressions", () => {
    const baseline = createArtifact([
      createFinding({ fingerprint: "sha256:a", severity: "medium" }),
    ]);
    const current = createArtifact([
      createFinding({ fingerprint: "sha256:a", severity: "critical" }),
    ]);

    const result = computeRegression(current, baseline);
    expect(result.severityRegressions).toHaveLength(1);
    expect(result.severityRegressions[0].previousSeverity).toBe("medium");
    expect(result.severityRegressions[0].currentSeverity).toBe("critical");
  });

  it("does not count severity improvements as regressions", () => {
    const baseline = createArtifact([
      createFinding({ fingerprint: "sha256:a", severity: "critical" }),
    ]);
    const current = createArtifact([
      createFinding({ fingerprint: "sha256:a", severity: "low" }),
    ]);

    const result = computeRegression(current, baseline);
    expect(result.severityRegressions).toHaveLength(0);
  });

  it("calculates net change correctly", () => {
    const baseline = createArtifact([
      createFinding({ fingerprint: "sha256:a" }),
      createFinding({ fingerprint: "sha256:b" }),
    ]);
    const current = createArtifact([
      createFinding({ fingerprint: "sha256:a" }),
      createFinding({ fingerprint: "sha256:c" }),
      createFinding({ fingerprint: "sha256:d" }),
    ]);

    const result = computeRegression(current, baseline);
    expect(result.netChange).toBe(1); // 3 - 2 = 1
  });
});

describe("regression helpers", () => {
  it("hasNewHighCritical detects new high findings", () => {
    const regression = {
      baselineId: "test",
      baselineGeneratedAt: new Date().toISOString(),
      newFindings: [
        { findingId: "f-1", fingerprint: "sha256:a", severity: "high" as const, ruleId: "VC-AUTH-001", title: "Test" },
      ],
      resolvedFindings: [],
      persistingCount: 0,
      severityRegressions: [],
      netChange: 1,
    };
    expect(hasNewHighCritical(regression)).toBe(true);
  });

  it("hasNewHighCritical detects new critical findings", () => {
    const regression = {
      baselineId: "test",
      baselineGeneratedAt: new Date().toISOString(),
      newFindings: [
        { findingId: "f-1", fingerprint: "sha256:a", severity: "critical" as const, ruleId: "VC-AUTH-001", title: "Test" },
      ],
      resolvedFindings: [],
      persistingCount: 0,
      severityRegressions: [],
      netChange: 1,
    };
    expect(hasNewHighCritical(regression)).toBe(true);
  });

  it("hasNewHighCritical returns false for only medium/low/info", () => {
    const regression = {
      baselineId: "test",
      baselineGeneratedAt: new Date().toISOString(),
      newFindings: [
        { findingId: "f-1", fingerprint: "sha256:a", severity: "medium" as const, ruleId: "VC-AUTH-001", title: "Test" },
        { findingId: "f-2", fingerprint: "sha256:b", severity: "low" as const, ruleId: "VC-AUTH-002", title: "Test" },
      ],
      resolvedFindings: [],
      persistingCount: 0,
      severityRegressions: [],
      netChange: 2,
    };
    expect(hasNewHighCritical(regression)).toBe(false);
  });

  it("getNewHighCriticalIds returns correct IDs", () => {
    const regression = {
      baselineId: "test",
      baselineGeneratedAt: new Date().toISOString(),
      newFindings: [
        { findingId: "f-1", fingerprint: "sha256:a", severity: "high" as const, ruleId: "VC-AUTH-001", title: "Test" },
        { findingId: "f-2", fingerprint: "sha256:b", severity: "medium" as const, ruleId: "VC-AUTH-002", title: "Test" },
        { findingId: "f-3", fingerprint: "sha256:c", severity: "critical" as const, ruleId: "VC-AUTH-003", title: "Test" },
      ],
      resolvedFindings: [],
      persistingCount: 0,
      severityRegressions: [],
      netChange: 3,
    };
    expect(getNewHighCriticalIds(regression)).toEqual(["f-1", "f-3"]);
  });

  it("hasSeverityRegressions detects regressions", () => {
    const regression = {
      baselineId: "test",
      baselineGeneratedAt: new Date().toISOString(),
      newFindings: [],
      resolvedFindings: [],
      persistingCount: 1,
      severityRegressions: [
        { fingerprint: "sha256:a", ruleId: "VC-AUTH-001", previousSeverity: "medium" as const, currentSeverity: "high" as const, title: "Test" },
      ],
      netChange: 0,
    };
    expect(hasSeverityRegressions(regression)).toBe(true);
  });

  it("hasNetIncrease detects positive change", () => {
    const regression = {
      baselineId: "test",
      baselineGeneratedAt: new Date().toISOString(),
      newFindings: [],
      resolvedFindings: [],
      persistingCount: 0,
      severityRegressions: [],
      netChange: 5,
    };
    expect(hasNetIncrease(regression)).toBe(true);
  });

  it("hasNetIncrease returns false for zero or negative", () => {
    expect(hasNetIncrease({ netChange: 0 } as any)).toBe(false);
    expect(hasNetIncrease({ netChange: -2 } as any)).toBe(false);
  });
});

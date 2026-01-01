import { describe, it, expect } from "vitest";
import type { ScanArtifact, Finding } from "@vibecheck/schema";
import { evaluate, mergeConfigs } from "../evaluator.js";
import { getProfile } from "../profiles.js";
import type { PolicyConfig, Waiver } from "../schemas/index.js";

// Test fixtures
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
  artifactVersion: "0.2",
  generatedAt: new Date().toISOString(),
  tool: { name: "vibecheck", version: "0.0.1" },
  repo: { name: "test-repo", rootPathHash: "abc123" },
  summary: {
    totalFindings: findings.length,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    byCategory: {
      auth: 0, validation: 0, middleware: 0, secrets: 0,
      injection: 0, privacy: 0, config: 0, network: 0,
      crypto: 0, uploads: 0, hallucinations: 0, other: 0,
    },
  },
  findings,
});

describe("evaluate", () => {
  describe("basic evaluation", () => {
    it("returns pass for empty findings", () => {
      const artifact = createArtifact([]);
      const result = evaluate({ artifact });
      expect(result.status).toBe("pass");
      expect(result.exitCode).toBe(0);
    });

    it("returns pass for low severity findings with default profile", () => {
      const artifact = createArtifact([
        createFinding({ severity: "low", confidence: 0.8 }),
      ]);
      const result = evaluate({ artifact, profile: "startup" });
      expect(result.status).toBe("pass");
    });

    it("returns warn for high severity findings with startup profile", () => {
      const artifact = createArtifact([
        createFinding({ severity: "high", confidence: 0.8 }),
      ]);
      const result = evaluate({ artifact, profile: "startup" });
      expect(result.status).toBe("warn");
      expect(result.exitCode).toBe(0);
    });

    it("returns fail for critical findings with startup profile", () => {
      const artifact = createArtifact([
        createFinding({ severity: "critical", confidence: 0.8 }),
      ]);
      const result = evaluate({ artifact, profile: "startup" });
      expect(result.status).toBe("fail");
      expect(result.exitCode).toBe(1);
    });

    it("returns fail for high severity with strict profile", () => {
      const artifact = createArtifact([
        createFinding({ severity: "high", confidence: 0.8 }),
      ]);
      const result = evaluate({ artifact, profile: "strict" });
      expect(result.status).toBe("fail");
      expect(result.exitCode).toBe(1);
    });
  });

  describe("confidence thresholds", () => {
    it("ignores low confidence findings for fail", () => {
      const artifact = createArtifact([
        createFinding({ severity: "critical", confidence: 0.3 }),
      ]);
      const result = evaluate({
        artifact,
        config: {
          thresholds: {
            failOnSeverity: "critical",
            warnOnSeverity: "medium",
            minConfidenceForFail: 0.7,
            minConfidenceForWarn: 0.5,
            minConfidenceCritical: 0.5, // Still needs 0.5
            maxFindings: 0,
            maxCritical: 0,
            maxHigh: 0,
          },
          overrides: [],
          regression: {
            failOnNewHighCritical: true,
            failOnSeverityRegression: false,
            failOnNetIncrease: false,
            warnOnNewFindings: true,
          },
        },
      });
      // 0.3 < 0.5 minConfidenceCritical, so should pass
      expect(result.status).toBe("pass");
    });

    it("uses lower confidence threshold for critical", () => {
      const artifact = createArtifact([
        createFinding({ severity: "critical", confidence: 0.55 }),
      ]);
      const result = evaluate({
        artifact,
        config: {
          thresholds: {
            failOnSeverity: "critical",
            warnOnSeverity: "high",
            minConfidenceForFail: 0.8, // High threshold
            minConfidenceForWarn: 0.6,
            minConfidenceCritical: 0.5, // Lower for critical
            maxFindings: 0,
            maxCritical: 0,
            maxHigh: 0,
          },
          overrides: [],
          regression: {
            failOnNewHighCritical: true,
            failOnSeverityRegression: false,
            failOnNetIncrease: false,
            warnOnNewFindings: true,
          },
        },
      });
      expect(result.status).toBe("fail");
    });
  });

  describe("count thresholds", () => {
    it("fails when maxFindings exceeded", () => {
      const artifact = createArtifact([
        createFinding({ severity: "low" }),
        createFinding({ severity: "low" }),
        createFinding({ severity: "low" }),
      ]);
      const result = evaluate({
        artifact,
        config: {
          thresholds: {
            failOnSeverity: "critical",
            warnOnSeverity: "high",
            minConfidenceForFail: 0.7,
            minConfidenceForWarn: 0.5,
            minConfidenceCritical: 0.5,
            maxFindings: 2, // Exceeded
            maxCritical: 0,
            maxHigh: 0,
          },
          overrides: [],
          regression: {
            failOnNewHighCritical: true,
            failOnSeverityRegression: false,
            failOnNetIncrease: false,
            warnOnNewFindings: true,
          },
        },
      });
      expect(result.status).toBe("fail");
      expect(result.reasons.some(r => r.code === "count_threshold")).toBe(true);
    });

    it("fails when maxCritical exceeded", () => {
      const artifact = createArtifact([
        createFinding({ severity: "critical", confidence: 0.3 }), // Low conf, won't trigger severity threshold
        createFinding({ severity: "critical", confidence: 0.3 }),
      ]);
      const result = evaluate({
        artifact,
        config: {
          thresholds: {
            failOnSeverity: "critical",
            warnOnSeverity: "high",
            minConfidenceForFail: 0.8, // High threshold
            minConfidenceForWarn: 0.6,
            minConfidenceCritical: 0.7, // Also high
            maxFindings: 0,
            maxCritical: 1, // Exceeded
            maxHigh: 0,
          },
          overrides: [],
          regression: {
            failOnNewHighCritical: true,
            failOnSeverityRegression: false,
            failOnNetIncrease: false,
            warnOnNewFindings: true,
          },
        },
      });
      expect(result.status).toBe("fail");
    });
  });

  describe("overrides", () => {
    it("ignores findings matching ignore override", () => {
      const artifact = createArtifact([
        createFinding({ ruleId: "VC-AUTH-001", severity: "critical" }),
      ]);
      const result = evaluate({
        artifact,
        config: {
          thresholds: getProfile("strict").thresholds,
          overrides: [
            { ruleId: "VC-AUTH-001", action: "ignore" },
          ],
          regression: getProfile("strict").regression,
        },
      });
      expect(result.status).toBe("pass");
      expect(result.summary.ignored).toBe(1);
    });

    it("downgrades severity with downgrade override", () => {
      const artifact = createArtifact([
        createFinding({ ruleId: "VC-AUTH-001", severity: "critical" }),
      ]);
      const result = evaluate({
        artifact,
        config: {
          thresholds: {
            failOnSeverity: "critical",
            warnOnSeverity: "high",
            minConfidenceForFail: 0.5,
            minConfidenceForWarn: 0.3,
            minConfidenceCritical: 0.5,
            maxFindings: 0,
            maxCritical: 0,
            maxHigh: 0,
          },
          overrides: [
            { ruleId: "VC-AUTH-001", action: "downgrade", severity: "low" },
          ],
          regression: getProfile("startup").regression,
        },
      });
      expect(result.status).toBe("pass"); // Downgraded to low
      expect(result.activeFindings[0].severity).toBe("low");
      expect(result.activeFindings[0].originalSeverity).toBe("critical");
    });

    it("applies override with path pattern", () => {
      const artifact = createArtifact([
        createFinding({
          ruleId: "VC-AUTH-001",
          severity: "critical",
          evidence: [{ file: "src/legacy/old.ts", startLine: 1, endLine: 2, label: "L" }],
        }),
      ]);
      const result = evaluate({
        artifact,
        config: {
          thresholds: getProfile("strict").thresholds,
          overrides: [
            { ruleId: "VC-AUTH-*", pathPattern: "src/legacy/**", action: "ignore" },
          ],
          regression: getProfile("strict").regression,
        },
      });
      expect(result.status).toBe("pass");
      expect(result.summary.ignored).toBe(1);
    });

    it("applies category override", () => {
      const artifact = createArtifact([
        createFinding({ category: "auth", severity: "critical" }),
        createFinding({ category: "validation", severity: "critical" }),
      ]);
      const result = evaluate({
        artifact,
        config: {
          thresholds: getProfile("strict").thresholds,
          overrides: [
            { category: "auth", action: "ignore" },
          ],
          regression: getProfile("strict").regression,
        },
      });
      expect(result.status).toBe("fail"); // validation finding still fails
      expect(result.summary.ignored).toBe(1);
      expect(result.activeFindings).toHaveLength(1);
    });
  });

  describe("waivers", () => {
    it("waives findings matching fingerprint", () => {
      const artifact = createArtifact([
        createFinding({ fingerprint: "sha256:waived", severity: "critical" }),
      ]);
      const waivers: Waiver[] = [
        {
          id: "w-1",
          match: { fingerprint: "sha256:waived" },
          reason: "Accepted risk",
          createdBy: "test@example.com",
          createdAt: new Date().toISOString(),
        },
      ];
      const result = evaluate({ artifact, waivers, profile: "strict" });
      expect(result.status).toBe("pass");
      expect(result.waivedFindings).toHaveLength(1);
      expect(result.summary.waived).toBe(1);
    });

    it("waives findings matching ruleId pattern", () => {
      const artifact = createArtifact([
        createFinding({ ruleId: "VC-AUTH-001", severity: "critical" }),
        createFinding({ ruleId: "VC-AUTH-002", severity: "critical" }),
        createFinding({ ruleId: "VC-VAL-001", severity: "critical" }),
      ]);
      const waivers: Waiver[] = [
        {
          id: "w-1",
          match: { ruleId: "VC-AUTH-*" },
          reason: "All auth issues waived",
          createdBy: "test@example.com",
          createdAt: new Date().toISOString(),
        },
      ];
      const result = evaluate({ artifact, waivers, profile: "strict" });
      expect(result.waivedFindings).toHaveLength(2);
      expect(result.activeFindings).toHaveLength(1);
      expect(result.status).toBe("fail"); // VAL-001 still fails
    });
  });

  describe("regression", () => {
    it("fails on new high/critical when policy enabled", () => {
      const baseline = createArtifact([
        createFinding({ fingerprint: "sha256:existing", severity: "low" }),
      ]);
      const current = createArtifact([
        createFinding({ fingerprint: "sha256:existing", severity: "low" }),
        createFinding({ id: "new-1", fingerprint: "sha256:new", severity: "high", confidence: 0.3 }),
      ]);

      const result = evaluate({
        artifact: current,
        baseline,
        config: {
          thresholds: {
            failOnSeverity: "critical",
            warnOnSeverity: "high",
            minConfidenceForFail: 0.9, // High threshold to not fail on severity alone
            minConfidenceForWarn: 0.8,
            minConfidenceCritical: 0.9,
            maxFindings: 0,
            maxCritical: 0,
            maxHigh: 0,
          },
          overrides: [],
          regression: {
            failOnNewHighCritical: true,
            failOnSeverityRegression: false,
            failOnNetIncrease: false,
            warnOnNewFindings: true,
          },
        },
      });

      expect(result.status).toBe("fail");
      expect(result.reasons.some(r => r.code === "new_high_critical")).toBe(true);
      expect(result.regression?.newFindings).toHaveLength(1);
    });

    it("fails on severity regression when policy enabled", () => {
      const baseline = createArtifact([
        createFinding({ fingerprint: "sha256:regressed", severity: "low" }),
      ]);
      const current = createArtifact([
        createFinding({ fingerprint: "sha256:regressed", severity: "critical", confidence: 0.3 }),
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
            failOnSeverityRegression: true,
            failOnNetIncrease: false,
            warnOnNewFindings: false,
          },
        },
      });

      expect(result.status).toBe("fail");
      expect(result.reasons.some(r => r.code === "severity_regression")).toBe(true);
      expect(result.regression?.severityRegressions).toHaveLength(1);
    });

    it("tracks resolved findings", () => {
      const baseline = createArtifact([
        createFinding({ fingerprint: "sha256:resolved", severity: "high" }),
        createFinding({ fingerprint: "sha256:kept", severity: "low" }),
      ]);
      const current = createArtifact([
        createFinding({ fingerprint: "sha256:kept", severity: "low" }),
      ]);

      const result = evaluate({
        artifact: current,
        baseline,
        profile: "startup",
      });

      expect(result.regression?.resolvedFindings).toHaveLength(1);
      expect(result.regression?.resolvedFindings[0].fingerprint).toBe("sha256:resolved");
    });
  });

  describe("report structure", () => {
    it("includes all required fields", () => {
      const artifact = createArtifact([createFinding()]);
      const result = evaluate({ artifact, profile: "startup" });

      expect(result.policyVersion).toBe("0.1");
      expect(result.evaluatedAt).toBeDefined();
      expect(result.profileName).toBe("startup");
      expect(result.status).toBeDefined();
      expect(result.thresholds).toBeDefined();
      expect(result.overrides).toBeDefined();
      expect(result.regressionPolicy).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.reasons).toBeDefined();
      expect(result.waivedFindings).toBeDefined();
      expect(result.activeFindings).toBeDefined();
      expect(result.exitCode).toBeDefined();
      expect(result.artifact).toBeDefined();
    });

    it("includes artifact path when provided", () => {
      const artifact = createArtifact([]);
      const result = evaluate({
        artifact,
        profile: "startup",
        artifactPath: "/path/to/scan.json",
      });
      expect(result.artifact.path).toBe("/path/to/scan.json");
    });
  });
});

describe("mergeConfigs", () => {
  it("merges thresholds", () => {
    const profile = getProfile("startup");
    const merged = mergeConfigs(profile, {
      thresholds: { failOnSeverity: "high" },
    });
    expect(merged.thresholds.failOnSeverity).toBe("high");
    expect(merged.thresholds.warnOnSeverity).toBe(profile.thresholds.warnOnSeverity);
  });

  it("combines overrides", () => {
    const profile = getProfile("startup");
    const merged = mergeConfigs(profile, {
      overrides: [{ ruleId: "VC-TEST-001", action: "ignore" }],
    });
    expect(merged.overrides).toHaveLength(1);
  });

  it("merges regression policy", () => {
    const profile = getProfile("startup");
    const merged = mergeConfigs(profile, {
      regression: { failOnNetIncrease: true },
    });
    expect(merged.regression.failOnNetIncrease).toBe(true);
    expect(merged.regression.failOnNewHighCritical).toBe(profile.regression.failOnNewHighCritical);
  });
});

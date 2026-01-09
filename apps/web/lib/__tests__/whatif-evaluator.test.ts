import { describe, it, expect } from "vitest";
import type { ScanArtifact, Finding } from "@vibecheck/schema";
import { evaluate, type ProfileName } from "@vibecheck/policy";
import {
  evaluateWithWhatIf,
  comparePolicyReports,
  getWhatIfSummary,
  wouldUnblockDeploy,
  convertToWaivers,
} from "../whatif-evaluator";
import {
  applyWhatIfOverrides,
  type WhatIfOverride,
  type WhatIfPathIgnore,
  getSeverityOrder,
  getLowerSeverity,
} from "../whatif-store";

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
// Parity Tests: No Overrides = Same Result
// ============================================================================

describe("evaluateWithWhatIf - parity with evaluate", () => {
  describe("with no overrides", () => {
    it("produces identical status for empty findings", () => {
      const artifact = createArtifact([]);
      const profile: ProfileName = "startup";

      const policyResult = evaluate({ artifact, profile });
      const whatIfResult = evaluateWithWhatIf({
        artifact,
        profile,
        whatIfOverrides: [],
        whatIfPathIgnores: [],
      });

      expect(whatIfResult.status).toBe(policyResult.status);
      expect(whatIfResult.exitCode).toBe(policyResult.exitCode);
      expect(whatIfResult.whatIf.originalStatus).toBe(policyResult.status);
      expect(whatIfResult.whatIf.ignoredByWhatIf).toBe(0);
      expect(whatIfResult.whatIf.modifiedByWhatIf).toBe(0);
      expect(whatIfResult.whatIf.changes).toHaveLength(0);
    });

    it("produces identical status for critical findings", () => {
      const artifact = createArtifact([
        createFinding({ severity: "critical", confidence: 0.9 }),
      ]);
      const profile: ProfileName = "startup";

      const policyResult = evaluate({ artifact, profile });
      const whatIfResult = evaluateWithWhatIf({
        artifact,
        profile,
        whatIfOverrides: [],
        whatIfPathIgnores: [],
      });

      expect(whatIfResult.status).toBe(policyResult.status);
      expect(whatIfResult.status).toBe("fail");
      expect(whatIfResult.exitCode).toBe(policyResult.exitCode);
      expect(whatIfResult.exitCode).toBe(1);
    });

    it("produces identical status across all profiles", () => {
      const artifact = createArtifact([
        createFinding({ severity: "high", confidence: 0.8 }),
      ]);

      const profiles: ProfileName[] = ["startup", "strict", "compliance-lite"];

      for (const profile of profiles) {
        const policyResult = evaluate({ artifact, profile });
        const whatIfResult = evaluateWithWhatIf({
          artifact,
          profile,
          whatIfOverrides: [],
          whatIfPathIgnores: [],
        });

        expect(whatIfResult.status).toBe(policyResult.status);
        expect(whatIfResult.exitCode).toBe(policyResult.exitCode);
        expect(whatIfResult.summary).toEqual(policyResult.summary);
      }
    });

    it("produces identical summary counts", () => {
      const artifact = createArtifact([
        createFinding({ severity: "critical" }),
        createFinding({ severity: "high" }),
        createFinding({ severity: "medium" }),
        createFinding({ severity: "low" }),
        createFinding({ severity: "info" }),
      ]);

      const policyResult = evaluate({ artifact, profile: "startup" });
      const whatIfResult = evaluateWithWhatIf({
        artifact,
        profile: "startup",
        whatIfOverrides: [],
        whatIfPathIgnores: [],
      });

      expect(whatIfResult.summary.total).toBe(policyResult.summary.total);
      expect(whatIfResult.summary.bySeverity).toEqual(policyResult.summary.bySeverity);
    });

    it("produces identical active findings list", () => {
      const findings = [
        createFinding({ id: "f1", severity: "high" }),
        createFinding({ id: "f2", severity: "medium" }),
      ];
      const artifact = createArtifact(findings);

      const policyResult = evaluate({ artifact, profile: "startup" });
      const whatIfResult = evaluateWithWhatIf({
        artifact,
        profile: "startup",
        whatIfOverrides: [],
        whatIfPathIgnores: [],
      });

      expect(whatIfResult.activeFindings.map(f => f.id)).toEqual(
        policyResult.activeFindings.map(f => f.id)
      );
    });
  });
});

// ============================================================================
// applyWhatIfOverrides Tests
// ============================================================================

describe("applyWhatIfOverrides", () => {
  describe("ignore action", () => {
    it("removes finding with ignore override by findingId", () => {
      const finding = createFinding({ id: "f1", severity: "critical" });
      const findings = [finding];
      const overrides: WhatIfOverride[] = [
        {
          findingId: "f1",
          fingerprint: finding.fingerprint,
          action: "ignore",
          reason: "Test ignore",
          createdAt: new Date().toISOString(),
        },
      ];

      const result = applyWhatIfOverrides(findings, overrides, []);

      expect(result.activeFindings).toHaveLength(0);
      expect(result.ignoredFindings).toHaveLength(1);
      expect(result.ignoredFindings[0].finding.id).toBe("f1");
    });

    it("removes finding with ignore override by fingerprint", () => {
      const finding = createFinding({ id: "f1", fingerprint: "sha256:known" });
      const findings = [finding];
      const overrides: WhatIfOverride[] = [
        {
          findingId: "different-id",
          fingerprint: "sha256:known",
          action: "ignore",
          reason: "Test ignore by fingerprint",
          createdAt: new Date().toISOString(),
        },
      ];

      const result = applyWhatIfOverrides(findings, overrides, []);

      expect(result.activeFindings).toHaveLength(0);
      expect(result.ignoredFindings).toHaveLength(1);
    });
  });

  describe("waive action", () => {
    it("removes finding with waive override", () => {
      const finding = createFinding({ id: "f1" });
      const findings = [finding];
      const overrides: WhatIfOverride[] = [
        {
          findingId: "f1",
          fingerprint: finding.fingerprint,
          action: "waive",
          reason: "Accepted risk",
          createdAt: new Date().toISOString(),
        },
      ];

      const result = applyWhatIfOverrides(findings, overrides, []);

      expect(result.activeFindings).toHaveLength(0);
      expect(result.ignoredFindings).toHaveLength(1);
    });
  });

  describe("downgrade action", () => {
    it("changes finding severity with downgrade override", () => {
      const finding = createFinding({ id: "f1", severity: "critical" });
      const findings = [finding];
      const overrides: WhatIfOverride[] = [
        {
          findingId: "f1",
          fingerprint: finding.fingerprint,
          action: "downgrade",
          newSeverity: "low",
          reason: "False positive",
          createdAt: new Date().toISOString(),
        },
      ];

      const result = applyWhatIfOverrides(findings, overrides, []);

      expect(result.activeFindings).toHaveLength(1);
      expect(result.activeFindings[0].severity).toBe("low");
      expect(result.modifiedFindings).toHaveLength(1);
      expect(result.modifiedFindings[0].originalSeverity).toBe("critical");
    });

    it("tracks original severity in modifiedFindings", () => {
      const finding = createFinding({ severity: "high" });
      const overrides: WhatIfOverride[] = [
        {
          findingId: finding.id,
          fingerprint: finding.fingerprint,
          action: "downgrade",
          newSeverity: "info",
          reason: "Not applicable",
          createdAt: new Date().toISOString(),
        },
      ];

      const result = applyWhatIfOverrides([finding], overrides, []);

      expect(result.modifiedFindings[0].originalSeverity).toBe("high");
      expect(result.modifiedFindings[0].finding.severity).toBe("info");
    });
  });

  describe("path pattern ignores", () => {
    it("ignores findings matching path pattern", () => {
      const finding = createFinding({
        evidence: [{ file: "src/legacy/old-code.ts", startLine: 1, endLine: 2, label: "L" }],
      });
      const pathIgnores: WhatIfPathIgnore[] = [
        {
          id: "p1",
          pathPattern: "src/legacy/**",
          reason: "Legacy code",
          createdAt: new Date().toISOString(),
        },
      ];

      const result = applyWhatIfOverrides([finding], [], pathIgnores);

      expect(result.activeFindings).toHaveLength(0);
      expect(result.ignoredFindings).toHaveLength(1);
    });

    it("ignores findings matching path pattern with rule filter", () => {
      const finding1 = createFinding({
        ruleId: "VC-AUTH-001",
        evidence: [{ file: "src/test/auth.ts", startLine: 1, endLine: 2, label: "L" }],
      });
      const finding2 = createFinding({
        ruleId: "VC-VAL-001",
        evidence: [{ file: "src/test/val.ts", startLine: 1, endLine: 2, label: "L" }],
      });
      const pathIgnores: WhatIfPathIgnore[] = [
        {
          id: "p1",
          pathPattern: "src/test/**",
          ruleId: "VC-AUTH-*",
          reason: "Only ignore auth in tests",
          createdAt: new Date().toISOString(),
        },
      ];

      const result = applyWhatIfOverrides([finding1, finding2], [], pathIgnores);

      expect(result.activeFindings).toHaveLength(1);
      expect(result.activeFindings[0].ruleId).toBe("VC-VAL-001");
      expect(result.ignoredFindings).toHaveLength(1);
      expect(result.ignoredFindings[0].finding.ruleId).toBe("VC-AUTH-001");
    });

    it("does not ignore findings not matching path pattern", () => {
      const finding = createFinding({
        evidence: [{ file: "src/api/secure.ts", startLine: 1, endLine: 2, label: "L" }],
      });
      const pathIgnores: WhatIfPathIgnore[] = [
        {
          id: "p1",
          pathPattern: "src/legacy/**",
          reason: "Legacy code",
          createdAt: new Date().toISOString(),
        },
      ];

      const result = applyWhatIfOverrides([finding], [], pathIgnores);

      expect(result.activeFindings).toHaveLength(1);
      expect(result.ignoredFindings).toHaveLength(0);
    });
  });

  describe("multiple overrides", () => {
    it("applies overrides to multiple findings", () => {
      const findings = [
        createFinding({ id: "f1", severity: "critical" }),
        createFinding({ id: "f2", severity: "high" }),
        createFinding({ id: "f3", severity: "medium" }),
      ];
      const overrides: WhatIfOverride[] = [
        {
          findingId: "f1",
          fingerprint: findings[0].fingerprint,
          action: "ignore",
          reason: "Ignored",
          createdAt: new Date().toISOString(),
        },
        {
          findingId: "f2",
          fingerprint: findings[1].fingerprint,
          action: "downgrade",
          newSeverity: "low",
          reason: "Downgraded",
          createdAt: new Date().toISOString(),
        },
      ];

      const result = applyWhatIfOverrides(findings, overrides, []);

      expect(result.activeFindings).toHaveLength(2);
      expect(result.ignoredFindings).toHaveLength(1);
      expect(result.modifiedFindings).toHaveLength(1);
    });
  });
});

// ============================================================================
// evaluateWithWhatIf with Overrides
// ============================================================================

describe("evaluateWithWhatIf - with overrides", () => {
  describe("status changes", () => {
    it("changes status from fail to pass when critical finding is ignored", () => {
      const finding = createFinding({ id: "f1", severity: "critical", confidence: 0.9 });
      const artifact = createArtifact([finding]);
      const profile: ProfileName = "startup";

      // First verify it fails without override
      const policyResult = evaluate({ artifact, profile });
      expect(policyResult.status).toBe("fail");

      // Now apply What-If override
      const whatIfResult = evaluateWithWhatIf({
        artifact,
        profile,
        whatIfOverrides: [
          {
            findingId: "f1",
            fingerprint: finding.fingerprint,
            action: "ignore",
            reason: "False positive",
            createdAt: new Date().toISOString(),
          },
        ],
        whatIfPathIgnores: [],
      });

      expect(whatIfResult.status).toBe("pass");
      expect(whatIfResult.whatIf.originalStatus).toBe("fail");
      expect(whatIfResult.whatIf.ignoredByWhatIf).toBe(1);
    });

    it("changes status from fail to pass when critical is downgraded to low", () => {
      const finding = createFinding({ severity: "critical", confidence: 0.9 });
      const artifact = createArtifact([finding]);

      const whatIfResult = evaluateWithWhatIf({
        artifact,
        profile: "startup",
        whatIfOverrides: [
          {
            findingId: finding.id,
            fingerprint: finding.fingerprint,
            action: "downgrade",
            newSeverity: "low",
            reason: "Not actually critical",
            createdAt: new Date().toISOString(),
          },
        ],
        whatIfPathIgnores: [],
      });

      expect(whatIfResult.status).toBe("pass");
      expect(whatIfResult.whatIf.originalStatus).toBe("fail");
      expect(whatIfResult.whatIf.modifiedByWhatIf).toBe(1);
    });

    it("tracks changes in whatIf metadata", () => {
      const finding = createFinding({ severity: "critical" });
      const artifact = createArtifact([finding]);

      const whatIfResult = evaluateWithWhatIf({
        artifact,
        profile: "startup",
        whatIfOverrides: [
          {
            findingId: finding.id,
            fingerprint: finding.fingerprint,
            action: "ignore",
            reason: "Test",
            createdAt: new Date().toISOString(),
          },
        ],
        whatIfPathIgnores: [],
      });

      expect(whatIfResult.whatIf.isSimulation).toBe(true);
      expect(whatIfResult.whatIf.changes).toHaveLength(1);
      expect(whatIfResult.whatIf.changes[0].type).toBe("ignored");
      expect(whatIfResult.whatIf.changes[0].reason).toBe("Test");
    });
  });

  describe("path pattern ignores in evaluation", () => {
    it("ignores findings based on path pattern and updates status", () => {
      const finding = createFinding({
        severity: "critical",
        confidence: 0.9,
        evidence: [{ file: "src/legacy/old.ts", startLine: 1, endLine: 2, label: "L" }],
      });
      const artifact = createArtifact([finding]);

      const whatIfResult = evaluateWithWhatIf({
        artifact,
        profile: "startup",
        whatIfOverrides: [],
        whatIfPathIgnores: [
          {
            id: "p1",
            pathPattern: "src/legacy/**",
            reason: "Legacy code accepted",
            createdAt: new Date().toISOString(),
          },
        ],
      });

      expect(whatIfResult.status).toBe("pass");
      expect(whatIfResult.whatIf.changes).toHaveLength(1);
      expect(whatIfResult.whatIf.changes[0].type).toBe("path_ignored");
      expect(whatIfResult.whatIf.changes[0].pathPattern).toBe("src/legacy/**");
    });
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

describe("comparePolicyReports", () => {
  it("detects status change", () => {
    const artifact = createArtifact([
      createFinding({ severity: "critical", confidence: 0.9 }),
    ]);

    const original = evaluate({ artifact, profile: "startup" });
    const simulation = evaluateWithWhatIf({
      artifact,
      profile: "startup",
      whatIfOverrides: [
        {
          findingId: artifact.findings[0].id,
          fingerprint: artifact.findings[0].fingerprint,
          action: "ignore",
          reason: "Test",
          createdAt: new Date().toISOString(),
        },
      ],
      whatIfPathIgnores: [],
    });

    const diff = comparePolicyReports(original, simulation);

    expect(diff.statusChanged).toBe(true);
    expect(diff.originalStatus).toBe("fail");
    expect(diff.newStatus).toBe("pass");
    expect(diff.wouldUnblock).toBe(true);
  });
});

describe("getWhatIfSummary", () => {
  it("returns correct summary for ignored findings", () => {
    const finding = createFinding();
    const artifact = createArtifact([finding]);

    const report = evaluateWithWhatIf({
      artifact,
      profile: "startup",
      whatIfOverrides: [
        {
          findingId: finding.id,
          fingerprint: finding.fingerprint,
          action: "ignore",
          reason: "Test",
          createdAt: new Date().toISOString(),
        },
      ],
      whatIfPathIgnores: [],
    });

    const summary = getWhatIfSummary(report);
    expect(summary).toContain("1 finding ignored");
  });

  it("returns no changes message when empty", () => {
    const artifact = createArtifact([]);
    const report = evaluateWithWhatIf({
      artifact,
      profile: "startup",
      whatIfOverrides: [],
      whatIfPathIgnores: [],
    });

    const summary = getWhatIfSummary(report);
    expect(summary).toBe("No simulation changes applied");
  });
});

describe("wouldUnblockDeploy", () => {
  it("returns true when fail becomes pass", () => {
    const finding = createFinding({ severity: "critical", confidence: 0.9 });
    const artifact = createArtifact([finding]);

    const report = evaluateWithWhatIf({
      artifact,
      profile: "startup",
      whatIfOverrides: [
        {
          findingId: finding.id,
          fingerprint: finding.fingerprint,
          action: "ignore",
          reason: "Test",
          createdAt: new Date().toISOString(),
        },
      ],
      whatIfPathIgnores: [],
    });

    expect(wouldUnblockDeploy(report)).toBe(true);
  });

  it("returns false when status was already pass", () => {
    const artifact = createArtifact([]);
    const report = evaluateWithWhatIf({
      artifact,
      profile: "startup",
      whatIfOverrides: [],
      whatIfPathIgnores: [],
    });

    expect(wouldUnblockDeploy(report)).toBe(false);
  });
});

describe("convertToWaivers", () => {
  it("converts waive overrides to waivers", () => {
    const overrides: WhatIfOverride[] = [
      {
        findingId: "f1",
        fingerprint: "sha256:abc",
        action: "waive",
        reason: "Accepted risk",
        createdAt: "2024-01-01T00:00:00Z",
      },
      {
        findingId: "f2",
        fingerprint: "sha256:def",
        action: "ignore", // Should not be included
        reason: "Ignored",
        createdAt: "2024-01-01T00:00:00Z",
      },
    ];

    const waivers = convertToWaivers(overrides);

    expect(waivers).toHaveLength(1);
    expect(waivers[0].match.fingerprint).toBe("sha256:abc");
    expect(waivers[0].reason).toBe("Accepted risk");
  });
});

describe("getSeverityOrder", () => {
  it("returns correct order for all severities", () => {
    expect(getSeverityOrder("critical")).toBe(4);
    expect(getSeverityOrder("high")).toBe(3);
    expect(getSeverityOrder("medium")).toBe(2);
    expect(getSeverityOrder("low")).toBe(1);
    expect(getSeverityOrder("info")).toBe(0);
  });
});

describe("getLowerSeverity", () => {
  it("returns next lower severity", () => {
    expect(getLowerSeverity("critical")).toBe("high");
    expect(getLowerSeverity("high")).toBe("medium");
    expect(getLowerSeverity("medium")).toBe("low");
    expect(getLowerSeverity("low")).toBe("info");
  });

  it("returns same severity for info (lowest)", () => {
    expect(getLowerSeverity("info")).toBe("info");
  });
});

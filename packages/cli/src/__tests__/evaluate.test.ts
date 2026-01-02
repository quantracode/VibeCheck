import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import type { ScanArtifact } from "@vibecheck/schema";
import type { WaiversFile, PolicyConfig } from "@vibecheck/policy";
import { executeEvaluate, type EvaluateOptions } from "../commands/evaluate.js";

// Create temp directory for test files
function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
}

function cleanupDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function createTestArtifact(findings: ScanArtifact["findings"] = []): ScanArtifact {
  // Count by category
  const byCategory = {
    auth: 0,
    validation: 0,
    middleware: 0,
    secrets: 0,
    injection: 0,
    privacy: 0,
    config: 0,
    network: 0,
    crypto: 0,
    uploads: 0,
    hallucinations: 0,
    abuse: 0,
    other: 0,
  };
  for (const f of findings) {
    if (f.category in byCategory) {
      byCategory[f.category as keyof typeof byCategory]++;
    }
  }

  return {
    artifactVersion: "0.2",
    generatedAt: new Date().toISOString(),
    tool: { name: "vibecheck", version: "0.0.1" },
    repo: { name: "test-repo", rootPathHash: "abc123" },
    summary: {
      totalFindings: findings.length,
      bySeverity: {
        critical: findings.filter((f) => f.severity === "critical").length,
        high: findings.filter((f) => f.severity === "high").length,
        medium: findings.filter((f) => f.severity === "medium").length,
        low: findings.filter((f) => f.severity === "low").length,
        info: findings.filter((f) => f.severity === "info").length,
      },
      byCategory,
    },
    findings,
  };
}

function createTestFinding(overrides: Partial<ScanArtifact["findings"][0]> = {}) {
  return {
    id: `f-${Math.random().toString(36).slice(2, 8)}`,
    severity: "high" as const,
    confidence: 0.9,
    category: "auth" as const,
    ruleId: "VC-AUTH-001",
    title: "Test finding",
    description: "Test description",
    evidence: [{ file: "test.ts", startLine: 1, endLine: 2, label: "Issue" }],
    remediation: { recommendedFix: "Fix it" },
    fingerprint: `sha256:${Math.random().toString(36).slice(2, 10)}`,
    ...overrides,
  };
}

describe("evaluate command", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupDir(tempDir);
  });

  it("evaluates artifact with no findings as pass", async () => {
    const artifact = createTestArtifact([]);
    const artifactPath = path.join(tempDir, "scan.json");
    fs.writeFileSync(artifactPath, JSON.stringify(artifact));

    const options: EvaluateOptions = {
      artifact: artifactPath,
      profile: "startup",
      quiet: true,
    };

    const exitCode = await executeEvaluate(options);
    expect(exitCode).toBe(0);
  });

  it("evaluates artifact with critical finding as fail", async () => {
    // startup profile: failOnSeverity = "critical"
    const artifact = createTestArtifact([
      createTestFinding({ severity: "critical", confidence: 0.9 }),
    ]);
    const artifactPath = path.join(tempDir, "scan.json");
    fs.writeFileSync(artifactPath, JSON.stringify(artifact));

    const options: EvaluateOptions = {
      artifact: artifactPath,
      profile: "startup",
      quiet: true,
    };

    const exitCode = await executeEvaluate(options);
    expect(exitCode).toBe(1);
  });

  it("respects waivers file", async () => {
    const fingerprint = "sha256:waived123";
    const artifact = createTestArtifact([
      createTestFinding({ severity: "high", fingerprint }),
    ]);
    const artifactPath = path.join(tempDir, "scan.json");
    fs.writeFileSync(artifactPath, JSON.stringify(artifact));

    const waiversFile: WaiversFile = {
      version: "0.1",
      waivers: [
        {
          id: "w-1",
          match: { fingerprint },
          reason: "Accepted risk",
          createdBy: "test@example.com",
          createdAt: new Date().toISOString(),
        },
      ],
    };
    const waiversPath = path.join(tempDir, "waivers.json");
    fs.writeFileSync(waiversPath, JSON.stringify(waiversFile));

    const options: EvaluateOptions = {
      artifact: artifactPath,
      profile: "startup",
      waivers: waiversPath,
      quiet: true,
    };

    const exitCode = await executeEvaluate(options);
    expect(exitCode).toBe(0); // Waived, so should pass
  });

  it("outputs report to file", async () => {
    const artifact = createTestArtifact([]);
    const artifactPath = path.join(tempDir, "scan.json");
    fs.writeFileSync(artifactPath, JSON.stringify(artifact));

    const reportPath = path.join(tempDir, "report.json");
    const options: EvaluateOptions = {
      artifact: artifactPath,
      profile: "startup",
      out: reportPath,
      quiet: true,
    };

    await executeEvaluate(options);

    expect(fs.existsSync(reportPath)).toBe(true);
    const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
    expect(report.policyVersion).toBe("0.1");
    expect(report.status).toBe("pass");
    expect(report.profileName).toBe("startup");
  });

  it("uses strict profile correctly", async () => {
    // strict profile: failOnSeverity = "high", so high severity should fail
    const artifact = createTestArtifact([
      createTestFinding({ severity: "high", confidence: 0.8 }),
    ]);
    const artifactPath = path.join(tempDir, "scan.json");
    fs.writeFileSync(artifactPath, JSON.stringify(artifact));

    const options: EvaluateOptions = {
      artifact: artifactPath,
      profile: "strict",
      quiet: true,
    };

    const exitCode = await executeEvaluate(options);
    expect(exitCode).toBe(1); // Strict profile fails on high
  });

  it("detects regression from baseline", async () => {
    const baseline = createTestArtifact([
      createTestFinding({ fingerprint: "sha256:existing" }),
    ]);
    const current = createTestArtifact([
      createTestFinding({ fingerprint: "sha256:existing" }),
      createTestFinding({ fingerprint: "sha256:new", severity: "high" }),
    ]);

    const baselinePath = path.join(tempDir, "baseline.json");
    const currentPath = path.join(tempDir, "current.json");
    const reportPath = path.join(tempDir, "report.json");

    fs.writeFileSync(baselinePath, JSON.stringify(baseline));
    fs.writeFileSync(currentPath, JSON.stringify(current));

    const options: EvaluateOptions = {
      artifact: currentPath,
      baseline: baselinePath,
      profile: "startup",
      out: reportPath,
      quiet: true,
    };

    await executeEvaluate(options);

    const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
    expect(report.regression).toBeDefined();
    expect(report.regression.newFindings).toHaveLength(1);
    expect(report.regression.netChange).toBe(1);
  });

  it("throws on missing artifact file", async () => {
    const options: EvaluateOptions = {
      artifact: "/nonexistent/path/scan.json",
      profile: "startup",
      quiet: true,
    };

    await expect(executeEvaluate(options)).rejects.toThrow("Artifact file not found");
  });
});

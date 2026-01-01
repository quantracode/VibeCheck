import { describe, it, expect } from "vitest";
import { executeScan, type ScanOptions } from "../commands/scan.js";
import { executeExplain } from "../commands/explain.js";
import { ScanArtifactSchema } from "@vibecheck/schema";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

/**
 * Create default scan options with overrides
 */
function createScanOptions(overrides: Partial<ScanOptions> = {}): ScanOptions {
  return {
    out: "scan.json",
    format: "json",
    failOn: "critical",
    changed: false,
    emitIntentMap: false,
    exclude: [],
    includeTests: false,
    ...overrides,
  };
}

describe("scan command", () => {
  it("produces valid artifact", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const outputPath = path.join(tmpDir, "output", "scan.json");

    // Create a simple test file
    fs.writeFileSync(
      path.join(tmpDir, "app.ts"),
      `const url = process.env.DATABASE_URL;`
    );

    try {
      const options = createScanOptions({
        out: outputPath,
      });

      // Capture console output
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (...args) => logs.push(args.join(" "));

      await executeScan(tmpDir, options);

      console.log = originalLog;

      // Read and validate output
      const content = fs.readFileSync(outputPath, "utf-8");
      const artifact = JSON.parse(content);

      const result = ScanArtifactSchema.safeParse(artifact);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.artifactVersion).toBe("0.2");
        expect(result.data.tool.name).toBe("vibecheck");
        expect(result.data.findings.length).toBeGreaterThan(0);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("includes repo info when available", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const outputPath = path.join(tmpDir, "scan.json");

    fs.writeFileSync(path.join(tmpDir, "app.ts"), `const x = 1;`);

    try {
      const options = createScanOptions({
        out: outputPath,
        repoName: "test-repo",
      });

      const originalLog = console.log;
      console.log = () => {};

      await executeScan(tmpDir, options);

      console.log = originalLog;

      const artifact = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
      expect(artifact.repo.name).toBe("test-repo");
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("includes metrics in output", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const outputPath = path.join(tmpDir, "scan.json");

    fs.writeFileSync(path.join(tmpDir, "app.ts"), `const x = 1;`);

    try {
      const options = createScanOptions({
        out: outputPath,
      });

      const originalLog = console.log;
      console.log = () => {};

      await executeScan(tmpDir, options);

      console.log = originalLog;

      const artifact = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
      expect(artifact.metrics).toBeDefined();
      expect(artifact.metrics.filesScanned).toBe(1);
      expect(artifact.metrics.scanDurationMs).toBeGreaterThanOrEqual(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("exits with non-zero when findings exceed threshold", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const outputPath = path.join(tmpDir, "scan.json");

    // Create file with high severity finding
    fs.writeFileSync(
      path.join(tmpDir, "app.ts"),
      `const key = process.env.API_SECRET_KEY;`
    );

    try {
      const options = createScanOptions({
        out: outputPath,
        failOn: "high",
      });

      const originalLog = console.log;
      console.log = () => {};

      const exitCode = await executeScan(tmpDir, options);

      console.log = originalLog;

      expect(exitCode).toBe(1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("does not fail when --fail-on is off", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const outputPath = path.join(tmpDir, "scan.json");

    // Create file with high severity finding
    fs.writeFileSync(
      path.join(tmpDir, "app.ts"),
      `const key = process.env.API_SECRET_KEY;`
    );

    try {
      const options = createScanOptions({
        out: outputPath,
        failOn: "off",
      });

      const originalLog = console.log;
      console.log = () => {};

      const exitCode = await executeScan(tmpDir, options);

      console.log = originalLog;

      // Should not fail even with high severity findings
      expect(exitCode).toBe(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});

describe("exclude patterns", () => {
  it("excludes test files by default", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const outputPath = path.join(tmpDir, "scan.json");

    // Create source file and test file
    fs.writeFileSync(path.join(tmpDir, "app.ts"), `const x = 1;`);
    fs.writeFileSync(path.join(tmpDir, "app.test.ts"), `describe('test', () => {});`);

    try {
      const options = createScanOptions({
        out: outputPath,
      });

      const originalLog = console.log;
      console.log = () => {};

      await executeScan(tmpDir, options);

      console.log = originalLog;

      const artifact = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
      // Should only have scanned 1 file (not the test file)
      expect(artifact.metrics.filesScanned).toBe(1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("includes test files when --include-tests is set", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const outputPath = path.join(tmpDir, "scan.json");

    // Create source file and test file
    fs.writeFileSync(path.join(tmpDir, "app.ts"), `const x = 1;`);
    fs.writeFileSync(path.join(tmpDir, "app.test.ts"), `describe('test', () => {});`);

    try {
      const options = createScanOptions({
        out: outputPath,
        includeTests: true,
      });

      const originalLog = console.log;
      console.log = () => {};

      await executeScan(tmpDir, options);

      console.log = originalLog;

      const artifact = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
      // Should have scanned both files
      expect(artifact.metrics.filesScanned).toBe(2);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("applies custom exclude patterns", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const outputPath = path.join(tmpDir, "scan.json");

    // Create source files
    fs.writeFileSync(path.join(tmpDir, "app.ts"), `const x = 1;`);
    fs.writeFileSync(path.join(tmpDir, "legacy.ts"), `const y = 2;`);

    try {
      const options = createScanOptions({
        out: outputPath,
        exclude: ["**/legacy.ts"],
      });

      const originalLog = console.log;
      console.log = () => {};

      await executeScan(tmpDir, options);

      console.log = originalLog;

      const artifact = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
      // Should only have scanned 1 file (not the legacy file)
      expect(artifact.metrics.filesScanned).toBe(1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("excludes node_modules by default", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const outputPath = path.join(tmpDir, "scan.json");

    // Create source file and node_modules file
    fs.writeFileSync(path.join(tmpDir, "app.ts"), `const x = 1;`);
    fs.mkdirSync(path.join(tmpDir, "node_modules", "pkg"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "node_modules", "pkg", "index.ts"),
      `const y = 2;`
    );

    try {
      const options = createScanOptions({
        out: outputPath,
      });

      const originalLog = console.log;
      console.log = () => {};

      await executeScan(tmpDir, options);

      console.log = originalLog;

      const artifact = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
      // Should only have scanned 1 file (not node_modules)
      expect(artifact.metrics.filesScanned).toBe(1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});

describe("output formats", () => {
  it("outputs JSON format by default", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const outputPath = path.join(tmpDir, "scan.json");

    fs.writeFileSync(path.join(tmpDir, "app.ts"), `const x = 1;`);

    try {
      const options = createScanOptions({
        out: outputPath,
        format: "json",
      });

      const originalLog = console.log;
      console.log = () => {};

      await executeScan(tmpDir, options);

      console.log = originalLog;

      expect(fs.existsSync(outputPath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
      expect(content.artifactVersion).toBe("0.2");
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("outputs SARIF format when requested", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const outputPath = path.join(tmpDir, "scan.json");

    fs.writeFileSync(path.join(tmpDir, "app.ts"), `const x = 1;`);

    try {
      const options = createScanOptions({
        out: outputPath,
        format: "sarif",
      });

      const originalLog = console.log;
      console.log = () => {};

      await executeScan(tmpDir, options);

      console.log = originalLog;

      // SARIF file should exist with .sarif extension
      const sarifPath = outputPath.replace(".json", ".sarif");
      expect(fs.existsSync(sarifPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(sarifPath, "utf-8"));
      expect(content.$schema).toContain("sarif");
      expect(content.version).toBe("2.1.0");
      expect(content.runs).toHaveLength(1);
      expect(content.runs[0].tool.driver.name).toBe("vibecheck");
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("outputs both formats when format is 'both'", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const outputPath = path.join(tmpDir, "scan.json");

    fs.writeFileSync(path.join(tmpDir, "app.ts"), `const x = 1;`);

    try {
      const options = createScanOptions({
        out: outputPath,
        format: "both",
      });

      const originalLog = console.log;
      console.log = () => {};

      await executeScan(tmpDir, options);

      console.log = originalLog;

      // Both files should exist
      const jsonPath = outputPath;
      const sarifPath = outputPath.replace(".json", ".sarif");

      expect(fs.existsSync(jsonPath)).toBe(true);
      expect(fs.existsSync(sarifPath)).toBe(true);

      // Validate JSON
      const jsonContent = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      expect(jsonContent.artifactVersion).toBe("0.2");

      // Validate SARIF
      const sarifContent = JSON.parse(fs.readFileSync(sarifPath, "utf-8"));
      expect(sarifContent.version).toBe("2.1.0");
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("handles directory output path", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const outputDir = path.join(tmpDir, "reports");

    fs.writeFileSync(path.join(tmpDir, "app.ts"), `const x = 1;`);

    try {
      const options = createScanOptions({
        out: outputDir,
        format: "json",
      });

      const originalLog = console.log;
      console.log = () => {};

      await executeScan(tmpDir, options);

      console.log = originalLog;

      // Should create default filename in directory
      const expectedPath = path.join(outputDir, "vibecheck-scan.json");
      expect(fs.existsSync(expectedPath)).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});

describe("SARIF output", () => {
  it("includes correct SARIF schema", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const outputPath = path.join(tmpDir, "scan.sarif");

    fs.writeFileSync(
      path.join(tmpDir, "app.ts"),
      `const key = process.env.API_SECRET_KEY;`
    );

    try {
      const options = createScanOptions({
        out: outputPath,
        format: "sarif",
      });

      const originalLog = console.log;
      console.log = () => {};

      await executeScan(tmpDir, options);

      console.log = originalLog;

      const sarif = JSON.parse(fs.readFileSync(outputPath, "utf-8"));

      expect(sarif.$schema).toContain("sarif-schema-2.1.0");
      expect(sarif.version).toBe("2.1.0");
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("includes rules in SARIF output", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const outputPath = path.join(tmpDir, "scan.sarif");

    fs.writeFileSync(
      path.join(tmpDir, "app.ts"),
      `const key = process.env.API_SECRET_KEY;`
    );

    try {
      const options = createScanOptions({
        out: outputPath,
        format: "sarif",
      });

      const originalLog = console.log;
      console.log = () => {};

      await executeScan(tmpDir, options);

      console.log = originalLog;

      const sarif = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
      const rules = sarif.runs[0].tool.driver.rules;

      expect(rules.length).toBeGreaterThan(0);
      expect(rules[0].id).toMatch(/^VC-/);
      expect(rules[0].shortDescription).toBeDefined();
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("maps severity to SARIF levels correctly", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const outputPath = path.join(tmpDir, "scan.sarif");

    fs.writeFileSync(
      path.join(tmpDir, "app.ts"),
      `const key = process.env.API_SECRET_KEY;`
    );

    try {
      const options = createScanOptions({
        out: outputPath,
        format: "sarif",
      });

      const originalLog = console.log;
      console.log = () => {};

      await executeScan(tmpDir, options);

      console.log = originalLog;

      const sarif = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
      const results = sarif.runs[0].results;

      if (results.length > 0) {
        // SARIF levels should be one of: none, note, warning, error
        expect(["none", "note", "warning", "error"]).toContain(results[0].level);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});

describe("explain command", () => {
  it("reads and displays artifact", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const artifactPath = path.join(tmpDir, "scan.json");

    const artifact = {
      artifactVersion: "0.2",
      generatedAt: new Date().toISOString(),
      tool: { name: "vibecheck", version: "0.0.1" },
      summary: {
        totalFindings: 1,
        bySeverity: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
        byCategory: {
          auth: 1,
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
          other: 0,
        },
      },
      findings: [
        {
          id: "test-001",
          severity: "high",
          confidence: 0.9,
          category: "auth",
          ruleId: "VC-AUTH-001",
          title: "Test finding",
          description: "Test description",
          evidence: [
            { file: "test.ts", startLine: 1, endLine: 1, label: "Test label" },
          ],
          remediation: { recommendedFix: "Fix it" },
          fingerprint: "abc123",
        },
      ],
    };

    fs.writeFileSync(artifactPath, JSON.stringify(artifact));

    try {
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (...args) => logs.push(args.join(" "));

      const exitCode = await executeExplain(artifactPath, { limit: 5 });

      console.log = originalLog;

      expect(exitCode).toBe(0);
      expect(logs.some((l) => l.includes("VIBECHECK SCAN REPORT"))).toBe(true);
      expect(logs.some((l) => l.includes("Test finding"))).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("returns error for invalid artifact", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const artifactPath = path.join(tmpDir, "invalid.json");

    fs.writeFileSync(artifactPath, JSON.stringify({ invalid: true }));

    try {
      const originalLog = console.log;
      const originalError = console.error;
      console.log = () => {};
      console.error = () => {};

      const exitCode = await executeExplain(artifactPath, { limit: 5 });

      console.log = originalLog;
      console.error = originalError;

      expect(exitCode).toBe(1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});

describe("artifact output shape", () => {
  it("has correct structure", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const outputPath = path.join(tmpDir, "scan.json");

    fs.writeFileSync(
      path.join(tmpDir, "app.ts"),
      `import { z } from "zod";
// unused
`
    );

    try {
      const options = createScanOptions({
        out: outputPath,
      });

      const originalLog = console.log;
      console.log = () => {};

      await executeScan(tmpDir, options);

      console.log = originalLog;

      const artifact = JSON.parse(fs.readFileSync(outputPath, "utf-8"));

      // Check top-level structure
      expect(artifact).toHaveProperty("artifactVersion", "0.2");
      expect(artifact).toHaveProperty("generatedAt");
      expect(artifact).toHaveProperty("tool");
      expect(artifact).toHaveProperty("summary");
      expect(artifact).toHaveProperty("findings");

      // Check tool info
      expect(artifact.tool).toHaveProperty("name", "vibecheck");
      expect(artifact.tool).toHaveProperty("version");

      // Check summary structure
      expect(artifact.summary).toHaveProperty("totalFindings");
      expect(artifact.summary).toHaveProperty("bySeverity");
      expect(artifact.summary).toHaveProperty("byCategory");

      // Check finding structure (if any)
      if (artifact.findings.length > 0) {
        const finding = artifact.findings[0];
        expect(finding).toHaveProperty("id");
        expect(finding).toHaveProperty("severity");
        expect(finding).toHaveProperty("confidence");
        expect(finding).toHaveProperty("category");
        expect(finding).toHaveProperty("ruleId");
        expect(finding).toHaveProperty("title");
        expect(finding).toHaveProperty("description");
        expect(finding).toHaveProperty("evidence");
        expect(finding).toHaveProperty("remediation");
        expect(finding).toHaveProperty("fingerprint");

        // Check ruleId format
        expect(finding.ruleId).toMatch(/^VC-[A-Z]+-\d{3}$/);

        // Check evidence structure
        expect(finding.evidence[0]).toHaveProperty("file");
        expect(finding.evidence[0]).toHaveProperty("startLine");
        expect(finding.evidence[0]).toHaveProperty("endLine");
        expect(finding.evidence[0]).toHaveProperty("label");
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});

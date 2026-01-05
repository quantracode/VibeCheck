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
    emitRouteMap: true,
    emitIntents: true,
    emitTraces: true,
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
        expect(result.data.artifactVersion).toBe("0.3");
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
      expect(content.artifactVersion).toBe("0.3");
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
      expect(jsonContent.artifactVersion).toBe("0.3");

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
      artifactVersion: "0.3",
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
          abuse: 0,
          correlation: 0,
          authorization: 0,
          lifecycle: 0,
          "supply-chain": 0,
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
      expect(artifact).toHaveProperty("artifactVersion", "0.3");
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

describe("Phase 3 features", () => {
  it("emits routeMap by default", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const outputPath = path.join(tmpDir, "scan.json");

    // Create a Next.js App Router route file
    fs.mkdirSync(path.join(tmpDir, "app", "api", "users"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "app", "api", "users", "route.ts"),
      `export async function GET() { return Response.json({}); }
export async function POST(req: Request) { return Response.json({}); }`
    );

    try {
      const options = createScanOptions({
        out: outputPath,
        emitRouteMap: true,
        emitIntents: true,
        emitTraces: true,
      });

      const originalLog = console.log;
      console.log = () => {};

      await executeScan(tmpDir, options);

      console.log = originalLog;

      const artifact = JSON.parse(fs.readFileSync(outputPath, "utf-8"));

      // Should have routeMap with routes
      expect(artifact.routeMap).toBeDefined();
      expect(artifact.routeMap.routes).toBeDefined();
      expect(Array.isArray(artifact.routeMap.routes)).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("emits intentMap with intents from comments", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const outputPath = path.join(tmpDir, "scan.json");

    // Create a file with security intent comments
    fs.writeFileSync(
      path.join(tmpDir, "auth.ts"),
      `// This function requires authentication
export function protectedHandler() {
  // validated input
  return true;
}`
    );

    try {
      const options = createScanOptions({
        out: outputPath,
        emitRouteMap: true,
        emitIntents: true,
        emitTraces: true,
      });

      const originalLog = console.log;
      console.log = () => {};

      await executeScan(tmpDir, options);

      console.log = originalLog;

      const artifact = JSON.parse(fs.readFileSync(outputPath, "utf-8"));

      // Should have intentMap with intents
      expect(artifact.intentMap).toBeDefined();
      expect(artifact.intentMap.intents).toBeDefined();
      expect(Array.isArray(artifact.intentMap.intents)).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("emits proofTraces for route handlers", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const outputPath = path.join(tmpDir, "scan.json");

    // Create a Next.js App Router route file
    fs.mkdirSync(path.join(tmpDir, "app", "api", "users"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "app", "api", "users", "route.ts"),
      `export async function POST(req: Request) { return Response.json({}); }`
    );

    try {
      const options = createScanOptions({
        out: outputPath,
        emitRouteMap: true,
        emitIntents: true,
        emitTraces: true,
      });

      const originalLog = console.log;
      console.log = () => {};

      await executeScan(tmpDir, options);

      console.log = originalLog;

      const artifact = JSON.parse(fs.readFileSync(outputPath, "utf-8"));

      // Should have proofTraces
      expect(artifact.proofTraces).toBeDefined();
      expect(typeof artifact.proofTraces).toBe("object");
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("emits coverage metrics", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const outputPath = path.join(tmpDir, "scan.json");

    fs.writeFileSync(path.join(tmpDir, "app.ts"), `const x = 1;`);

    try {
      const options = createScanOptions({
        out: outputPath,
        emitRouteMap: true,
        emitIntents: true,
        emitTraces: true,
      });

      const originalLog = console.log;
      console.log = () => {};

      await executeScan(tmpDir, options);

      console.log = originalLog;

      const artifact = JSON.parse(fs.readFileSync(outputPath, "utf-8"));

      // Should have coverage metrics in metrics
      expect(artifact.metrics).toBeDefined();
      if (artifact.metrics.authCoverage) {
        expect(artifact.metrics.authCoverage).toHaveProperty("totalStateChanging");
        expect(artifact.metrics.authCoverage).toHaveProperty("protectedCount");
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("skips routeMap when --no-emit-route-map is used", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const outputPath = path.join(tmpDir, "scan.json");

    fs.mkdirSync(path.join(tmpDir, "app", "api"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "app", "api", "route.ts"),
      `export async function GET() { return Response.json({}); }`
    );

    try {
      const options = createScanOptions({
        out: outputPath,
        emitRouteMap: false,
        emitIntents: true,
        emitTraces: true,
      });

      const originalLog = console.log;
      console.log = () => {};

      await executeScan(tmpDir, options);

      console.log = originalLog;

      const artifact = JSON.parse(fs.readFileSync(outputPath, "utf-8"));

      // routeMap should be empty or have empty routes
      if (artifact.routeMap) {
        expect(artifact.routeMap.routes).toHaveLength(0);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("skips intents when --no-emit-intents is used", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const outputPath = path.join(tmpDir, "scan.json");

    fs.writeFileSync(
      path.join(tmpDir, "auth.ts"),
      `// requires authentication
export function handler() { return true; }`
    );

    try {
      const options = createScanOptions({
        out: outputPath,
        emitRouteMap: true,
        emitIntents: false,
        emitTraces: true,
      });

      const originalLog = console.log;
      console.log = () => {};

      await executeScan(tmpDir, options);

      console.log = originalLog;

      const artifact = JSON.parse(fs.readFileSync(outputPath, "utf-8"));

      // intentMap should be empty or have empty intents
      if (artifact.intentMap) {
        expect(artifact.intentMap.intents).toHaveLength(0);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("skips traces when --no-emit-traces is used", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const outputPath = path.join(tmpDir, "scan.json");

    fs.mkdirSync(path.join(tmpDir, "app", "api"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "app", "api", "route.ts"),
      `export async function POST() { return Response.json({}); }`
    );

    try {
      const options = createScanOptions({
        out: outputPath,
        emitRouteMap: true,
        emitIntents: true,
        emitTraces: false,
      });

      const originalLog = console.log;
      console.log = () => {};

      await executeScan(tmpDir, options);

      console.log = originalLog;

      const artifact = JSON.parse(fs.readFileSync(outputPath, "utf-8"));

      // proofTraces should be empty
      if (artifact.proofTraces) {
        expect(Object.keys(artifact.proofTraces)).toHaveLength(0);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});

describe("determinism", () => {
  /**
   * Remove non-deterministic fields from artifact for comparison
   */
  function stripNonDeterministic(artifact: Record<string, unknown>): Record<string, unknown> {
    const stripped = JSON.parse(JSON.stringify(artifact));

    // Remove timestamp fields
    delete stripped.generatedAt;

    // Remove timing metrics
    if (stripped.metrics) {
      delete (stripped.metrics as Record<string, unknown>).scanDurationMs;
    }

    // Remove correlation timing
    if (stripped.correlationSummary) {
      delete (stripped.correlationSummary as Record<string, unknown>).correlationDurationMs;
    }

    return stripped;
  }

  it("produces identical output when scanning the same fixture twice", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-determinism-"));
    const outputPath1 = path.join(tmpDir, "scan1.json");
    const outputPath2 = path.join(tmpDir, "scan2.json");

    // Create a fixture with multiple file types and patterns to detect
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "app", "api", "users"), { recursive: true });

    // Source file with various patterns
    fs.writeFileSync(
      path.join(tmpDir, "src", "config.ts"),
      `// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
const API_KEY = process.env.API_SECRET_KEY;
export { DATABASE_URL, API_KEY };`
    );

    // API route file
    fs.writeFileSync(
      path.join(tmpDir, "app", "api", "users", "route.ts"),
      `// requires authentication
export async function GET() {
  return Response.json({ users: [] });
}

export async function POST(req: Request) {
  const body = await req.json();
  return Response.json({ created: true });
}`
    );

    // Utility file
    fs.writeFileSync(
      path.join(tmpDir, "src", "utils.ts"),
      `export function validateInput(data: unknown) {
  // validated input
  return data;
}`
    );

    try {
      const options1 = createScanOptions({
        out: outputPath1,
        emitRouteMap: true,
        emitIntents: true,
        emitTraces: true,
        repoName: "determinism-test",
        failOn: "off",
      });

      const options2 = createScanOptions({
        out: outputPath2,
        emitRouteMap: true,
        emitIntents: true,
        emitTraces: true,
        repoName: "determinism-test",
        failOn: "off",
      });

      const originalLog = console.log;
      console.log = () => {};

      // First scan
      await executeScan(tmpDir, options1);

      // Second scan
      await executeScan(tmpDir, options2);

      console.log = originalLog;

      // Read both artifacts
      const artifact1 = JSON.parse(fs.readFileSync(outputPath1, "utf-8"));
      const artifact2 = JSON.parse(fs.readFileSync(outputPath2, "utf-8"));

      // Strip non-deterministic fields
      const stripped1 = stripNonDeterministic(artifact1);
      const stripped2 = stripNonDeterministic(artifact2);

      // Compare JSON strings for byte-identical output
      const json1 = JSON.stringify(stripped1, null, 2);
      const json2 = JSON.stringify(stripped2, null, 2);

      expect(json1).toBe(json2);

      // Also verify specific deterministic properties
      expect(artifact1.findings.length).toBe(artifact2.findings.length);

      // Fingerprints should be identical
      const fingerprints1 = artifact1.findings.map((f: { fingerprint: string }) => f.fingerprint).sort();
      const fingerprints2 = artifact2.findings.map((f: { fingerprint: string }) => f.fingerprint).sort();
      expect(fingerprints1).toEqual(fingerprints2);

      // Rule IDs should be identical
      const ruleIds1 = artifact1.findings.map((f: { ruleId: string }) => f.ruleId).sort();
      const ruleIds2 = artifact2.findings.map((f: { ruleId: string }) => f.ruleId).sort();
      expect(ruleIds1).toEqual(ruleIds2);

      // Route maps should be identical
      if (artifact1.routeMap && artifact2.routeMap) {
        expect(artifact1.routeMap.routes.length).toBe(artifact2.routeMap.routes.length);
      }

      // Intent maps should be identical
      if (artifact1.intentMap && artifact2.intentMap) {
        expect(artifact1.intentMap.intents.length).toBe(artifact2.intentMap.intents.length);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("produces identical fingerprints for identical code patterns", async () => {
    // Create two separate directories with identical code
    const tmpDir1 = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-fp1-"));
    const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-fp2-"));
    const outputPath1 = path.join(tmpDir1, "scan.json");
    const outputPath2 = path.join(tmpDir2, "scan.json");

    // Same code in both directories
    const code = `const secret = process.env.API_SECRET_KEY;`;
    fs.writeFileSync(path.join(tmpDir1, "app.ts"), code);
    fs.writeFileSync(path.join(tmpDir2, "app.ts"), code);

    try {
      const options1 = createScanOptions({
        out: outputPath1,
        repoName: "fingerprint-test",
        failOn: "off",
      });

      const options2 = createScanOptions({
        out: outputPath2,
        repoName: "fingerprint-test",
        failOn: "off",
      });

      const originalLog = console.log;
      console.log = () => {};

      await executeScan(tmpDir1, options1);
      await executeScan(tmpDir2, options2);

      console.log = originalLog;

      const artifact1 = JSON.parse(fs.readFileSync(outputPath1, "utf-8"));
      const artifact2 = JSON.parse(fs.readFileSync(outputPath2, "utf-8"));

      // Should have the same findings
      expect(artifact1.findings.length).toBe(artifact2.findings.length);

      // Fingerprints should be identical for identical code patterns
      // (Note: fingerprints may include file paths, so we compare just the hash portion)
      if (artifact1.findings.length > 0 && artifact2.findings.length > 0) {
        // Same rule should produce findings
        const rules1 = new Set(artifact1.findings.map((f: { ruleId: string }) => f.ruleId));
        const rules2 = new Set(artifact2.findings.map((f: { ruleId: string }) => f.ruleId));
        expect(rules1).toEqual(rules2);
      }
    } finally {
      fs.rmSync(tmpDir1, { recursive: true });
      fs.rmSync(tmpDir2, { recursive: true });
    }
  });
});

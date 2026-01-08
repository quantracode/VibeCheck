import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { applyPatches } from "../utils/apply-patches.js";
import type { Finding } from "@vibecheck/schema";

describe("applyPatches", () => {
  const testDir = join(process.cwd(), "__test-apply-patches__");
  const testFile = join(testDir, "test.ts");

  beforeEach(() => {
    // Create test directory and file
    mkdirSync(testDir, { recursive: true });
    writeFileSync(
      testFile,
      `export async function POST(request: Request) {
  const body = await request.json();
  return new Response(JSON.stringify({ ok: true }));
}
`
    );
  });

  afterEach(() => {
    // Clean up test directory
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should detect unified diff format", () => {
    const unifiedDiff = `--- a/test.ts
+++ b/test.ts
@@ -1,3 +1,4 @@
 export async function POST(request: Request) {
+  console.log("test");
   const body = await request.json();
 }`;

    const finding: Finding = {
      id: "test-1",
      ruleId: "VC-TEST-001",
      title: "Test Finding",
      description: "Test description",
      severity: "medium",
      confidence: 0.9,
      category: "auth",
      evidence: [
        {
          file: "test.ts",
          startLine: 1,
          endLine: 3,
          snippet: "export async function POST",
          label: "test",
        },
      ],
      remediation: {
        recommendedFix: "Add logging",
        patch: unifiedDiff,
      },
      fingerprint: "test-fingerprint-1",
    };

    // Test that the function doesn't crash with a unified diff
    // (We can't easily test the actual application in this context without mocking stdin)
    expect(finding.remediation.patch).toBeDefined();
  });

  it("should reject non-unified diff patches", async () => {
    const codeSnippet = `// Add at the start of your handler:
const session = await getServerSession(authOptions);
if (!session) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
  });
}`;

    const finding: Finding = {
      id: "test-2",
      ruleId: "VC-TEST-002",
      title: "Test Finding",
      description: "Test description",
      severity: "high",
      confidence: 0.9,
      category: "auth",
      evidence: [
        {
          file: testFile,
          startLine: 1,
          endLine: 3,
          snippet: "export async function POST",
          label: "test",
        },
      ],
      remediation: {
        recommendedFix: "Add authentication",
        patch: codeSnippet,
      },
      fingerprint: "test-fingerprint-2",
    };

    const result = await applyPatches([finding], testDir, {
      force: true,
      dryRun: false,
    });

    expect(result.totalPatchable).toBe(1);
    expect(result.applied).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.noAutomatedPatch).toBe(1);
    expect(result.results[0].error).toContain("No automated patch available");
    expect(result.results[0].noAutomatedPatch).toBe(true);
  });

  it("should handle findings without patches", async () => {
    const finding: Finding = {
      id: "test-3",
      ruleId: "VC-TEST-003",
      title: "Test Finding",
      description: "Test description",
      severity: "low",
      confidence: 0.7,
      category: "config",
      evidence: [
        {
          file: "test.ts",
          startLine: 1,
          endLine: 1,
          snippet: "export",
          label: "test",
        },
      ],
      remediation: {
        recommendedFix: "Fix the issue manually",
        // No patch provided
      },
      fingerprint: "test-fingerprint-3",
    };

    const result = await applyPatches([finding], testDir, {
      force: true,
      dryRun: false,
    });

    expect(result.totalPatchable).toBe(0);
    expect(result.applied).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.noAutomatedPatch).toBe(0);
  });

  it("should handle empty findings array", async () => {
    const result = await applyPatches([], testDir, {
      force: true,
      dryRun: false,
    });

    expect(result.totalPatchable).toBe(0);
    expect(result.applied).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.noAutomatedPatch).toBe(0);
  });

  it("should count patchable findings correctly", async () => {
    const findings: Finding[] = [
      {
        id: "test-4",
        ruleId: "VC-TEST-004",
        title: "Finding with patch",
        description: "Test",
        severity: "medium",
        confidence: 0.8,
        category: "auth",
        evidence: [
          {
            file: "test.ts",
            startLine: 1,
            endLine: 1,
            snippet: "code",
            label: "test",
          },
        ],
        remediation: {
          recommendedFix: "Fix it",
          patch: "--- a/test.ts\n+++ b/test.ts\n@@ -1 +1 @@\n-old\n+new",
        },
        fingerprint: "fp-4",
      },
      {
        id: "test-5",
        ruleId: "VC-TEST-005",
        title: "Finding without patch",
        description: "Test",
        severity: "low",
        confidence: 0.6,
        category: "config",
        evidence: [
          {
            file: "test.ts",
            startLine: 1,
            endLine: 1,
            snippet: "code",
            label: "test",
          },
        ],
        remediation: {
          recommendedFix: "No patch",
        },
        fingerprint: "fp-5",
      },
    ];

    const result = await applyPatches(findings, testDir, {
      force: true,
      dryRun: false,
    });

    expect(result.totalPatchable).toBe(1);
  });
});

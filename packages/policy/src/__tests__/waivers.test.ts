import { describe, it, expect } from "vitest";
import type { Finding } from "@vibecheck/schema";
import type { Waiver } from "../schemas/index.js";
import {
  matchRuleId,
  matchPathPattern,
  isWaiverExpired,
  matchWaiver,
  findMatchingWaiver,
  applyWaivers,
  createEmptyWaiversFile,
  createWaiver,
  addWaiver,
  removeWaiver,
} from "../waivers.js";

// Test fixtures
const createTestFinding = (overrides: Partial<Finding> = {}): Finding => ({
  id: "f-test-001",
  severity: "high",
  confidence: 0.9,
  category: "auth",
  ruleId: "VC-AUTH-001",
  title: "Test finding",
  description: "Test description",
  evidence: [
    { file: "src/api/users/route.ts", startLine: 10, endLine: 20, label: "Issue" },
  ],
  remediation: { recommendedFix: "Fix it" },
  fingerprint: "sha256:abc123",
  ...overrides,
});

const createTestWaiver = (overrides: Partial<Waiver> = {}): Waiver => ({
  id: "w-test-001",
  match: { fingerprint: "sha256:abc123" },
  reason: "Accepted risk",
  createdBy: "test@example.com",
  createdAt: "2024-01-01T00:00:00.000Z",
  ...overrides,
});

describe("matchRuleId", () => {
  it("matches exact rule ID", () => {
    expect(matchRuleId("VC-AUTH-001", "VC-AUTH-001")).toBe(true);
    expect(matchRuleId("VC-AUTH-001", "VC-AUTH-002")).toBe(false);
  });

  it("matches rule ID prefix with wildcard", () => {
    expect(matchRuleId("VC-AUTH-001", "VC-AUTH-*")).toBe(true);
    expect(matchRuleId("VC-AUTH-002", "VC-AUTH-*")).toBe(true);
    expect(matchRuleId("VC-VAL-001", "VC-AUTH-*")).toBe(false);
  });

  it("matches broader prefix", () => {
    expect(matchRuleId("VC-AUTH-001", "VC-*")).toBe(true);
    expect(matchRuleId("VC-VAL-001", "VC-*")).toBe(true);
  });
});

describe("matchPathPattern", () => {
  it("matches exact path", () => {
    expect(matchPathPattern(["src/api/users.ts"], "src/api/users.ts")).toBe(true);
  });

  it("matches glob pattern", () => {
    expect(matchPathPattern(["src/api/users/route.ts"], "src/api/**/*.ts")).toBe(true);
    expect(matchPathPattern(["src/api/users/route.ts"], "**/*.ts")).toBe(true);
    expect(matchPathPattern(["src/lib/util.ts"], "src/api/**/*.ts")).toBe(false);
  });

  it("returns true if any path matches", () => {
    const paths = ["src/lib/util.ts", "src/api/users.ts"];
    expect(matchPathPattern(paths, "src/api/**")).toBe(true);
  });
});

describe("isWaiverExpired", () => {
  it("returns false for waiver without expiry", () => {
    const waiver = createTestWaiver();
    expect(isWaiverExpired(waiver)).toBe(false);
  });

  it("returns false for waiver with future expiry", () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const waiver = createTestWaiver({ expiresAt: futureDate.toISOString() });
    expect(isWaiverExpired(waiver)).toBe(false);
  });

  it("returns true for expired waiver", () => {
    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 1);
    const waiver = createTestWaiver({ expiresAt: pastDate.toISOString() });
    expect(isWaiverExpired(waiver)).toBe(true);
  });
});

describe("matchWaiver", () => {
  it("matches by fingerprint", () => {
    const finding = createTestFinding({ fingerprint: "sha256:abc123" });
    const waiver = createTestWaiver({ match: { fingerprint: "sha256:abc123" } });
    const result = matchWaiver(waiver, finding);
    expect(result.matches).toBe(true);
    expect(result.expired).toBe(false);
  });

  it("does not match different fingerprint", () => {
    const finding = createTestFinding({ fingerprint: "sha256:xyz789" });
    const waiver = createTestWaiver({ match: { fingerprint: "sha256:abc123" } });
    const result = matchWaiver(waiver, finding);
    expect(result.matches).toBe(false);
  });

  it("matches by ruleId", () => {
    const finding = createTestFinding({ ruleId: "VC-AUTH-001" });
    const waiver = createTestWaiver({ match: { ruleId: "VC-AUTH-001" } });
    const result = matchWaiver(waiver, finding);
    expect(result.matches).toBe(true);
  });

  it("matches by ruleId with wildcard", () => {
    const finding = createTestFinding({ ruleId: "VC-AUTH-001" });
    const waiver = createTestWaiver({ match: { ruleId: "VC-AUTH-*" } });
    const result = matchWaiver(waiver, finding);
    expect(result.matches).toBe(true);
  });

  it("matches by ruleId + path pattern", () => {
    const finding = createTestFinding({
      ruleId: "VC-AUTH-001",
      evidence: [{ file: "src/api/users/route.ts", startLine: 1, endLine: 2, label: "L" }],
    });
    const waiver = createTestWaiver({
      match: { ruleId: "VC-AUTH-001", pathPattern: "src/api/**" },
    });
    const result = matchWaiver(waiver, finding);
    expect(result.matches).toBe(true);
  });

  it("does not match when path pattern fails", () => {
    const finding = createTestFinding({
      ruleId: "VC-AUTH-001",
      evidence: [{ file: "src/lib/util.ts", startLine: 1, endLine: 2, label: "L" }],
    });
    const waiver = createTestWaiver({
      match: { ruleId: "VC-AUTH-001", pathPattern: "src/api/**" },
    });
    const result = matchWaiver(waiver, finding);
    expect(result.matches).toBe(false);
  });

  it("reports expired status", () => {
    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 1);
    const finding = createTestFinding();
    const waiver = createTestWaiver({ expiresAt: pastDate.toISOString() });
    const result = matchWaiver(waiver, finding);
    expect(result.matches).toBe(true);
    expect(result.expired).toBe(true);
  });
});

describe("findMatchingWaiver", () => {
  it("finds first matching waiver", () => {
    const finding = createTestFinding({ fingerprint: "sha256:abc123" });
    const waivers = [
      createTestWaiver({ id: "w-1", match: { fingerprint: "sha256:xyz" } }),
      createTestWaiver({ id: "w-2", match: { fingerprint: "sha256:abc123" } }),
    ];
    const result = findMatchingWaiver(finding, waivers);
    expect(result).not.toBeNull();
    expect(result?.waiver.id).toBe("w-2");
  });

  it("returns null when no waiver matches", () => {
    const finding = createTestFinding({ fingerprint: "sha256:nomatch" });
    const waivers = [
      createTestWaiver({ match: { fingerprint: "sha256:abc123" } }),
    ];
    const result = findMatchingWaiver(finding, waivers);
    expect(result).toBeNull();
  });
});

describe("applyWaivers", () => {
  it("separates waived and active findings", () => {
    const findings = [
      createTestFinding({ id: "f-1", fingerprint: "sha256:waived" }),
      createTestFinding({ id: "f-2", fingerprint: "sha256:active" }),
    ];
    const waivers = [
      createTestWaiver({ match: { fingerprint: "sha256:waived" } }),
    ];
    const result = applyWaivers(findings, waivers);
    expect(result.waivedFindings).toHaveLength(1);
    expect(result.waivedFindings[0].finding.id).toBe("f-1");
    expect(result.activeFindings).toHaveLength(1);
    expect(result.activeFindings[0].id).toBe("f-2");
  });

  it("excludes expired waivers by default", () => {
    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 1);
    const findings = [createTestFinding({ fingerprint: "sha256:waived" })];
    const waivers = [
      createTestWaiver({
        match: { fingerprint: "sha256:waived" },
        expiresAt: pastDate.toISOString(),
      }),
    ];
    const result = applyWaivers(findings, waivers);
    expect(result.waivedFindings).toHaveLength(0);
    expect(result.activeFindings).toHaveLength(1);
  });

  it("includes expired waivers when option set", () => {
    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 1);
    const findings = [createTestFinding({ fingerprint: "sha256:waived" })];
    const waivers = [
      createTestWaiver({
        match: { fingerprint: "sha256:waived" },
        expiresAt: pastDate.toISOString(),
      }),
    ];
    const result = applyWaivers(findings, waivers, { includeExpired: true });
    expect(result.waivedFindings).toHaveLength(1);
    expect(result.waivedFindings[0].expired).toBe(true);
    expect(result.activeFindings).toHaveLength(0);
  });
});

describe("waiver file utilities", () => {
  it("creates empty waivers file", () => {
    const file = createEmptyWaiversFile();
    expect(file.version).toBe("0.1");
    expect(file.waivers).toEqual([]);
  });

  it("creates waiver", () => {
    const waiver = createWaiver({
      fingerprint: "sha256:abc",
      reason: "Test reason",
      createdBy: "test@example.com",
    });
    expect(waiver.id).toMatch(/^w-/);
    expect(waiver.match.fingerprint).toBe("sha256:abc");
    expect(waiver.reason).toBe("Test reason");
    expect(waiver.createdBy).toBe("test@example.com");
    expect(waiver.createdAt).toBeDefined();
  });

  it("adds waiver to file", () => {
    const file = createEmptyWaiversFile();
    const waiver = createWaiver({
      fingerprint: "sha256:abc",
      reason: "Test",
      createdBy: "test",
    });
    const updated = addWaiver(file, waiver);
    expect(updated.waivers).toHaveLength(1);
    expect(file.waivers).toHaveLength(0); // immutable
  });

  it("removes waiver from file", () => {
    const waiver = createWaiver({
      fingerprint: "sha256:abc",
      reason: "Test",
      createdBy: "test",
    });
    const file = addWaiver(createEmptyWaiversFile(), waiver);
    const updated = removeWaiver(file, waiver.id);
    expect(updated.waivers).toHaveLength(0);
  });
});

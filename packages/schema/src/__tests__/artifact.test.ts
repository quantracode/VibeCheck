import { describe, it, expect } from "vitest";
import {
  ARTIFACT_VERSION,
  ScanArtifactSchema,
  FindingSchema,
  ClaimSchema,
  ProofTraceSchema,
  EvidenceItemSchema,
  validateArtifact,
  safeValidateArtifact,
  ArtifactValidationError,
  computeSummary,
  type ScanArtifact,
  type Finding,
} from "../index.js";

describe("EvidenceItemSchema", () => {
  it("validates a valid evidence item", () => {
    const evidence = {
      file: "src/routes/auth.ts",
      startLine: 10,
      endLine: 15,
      snippet: "app.post('/login', handler)",
      label: "Unprotected login endpoint",
    };

    const result = EvidenceItemSchema.safeParse(evidence);
    expect(result.success).toBe(true);
  });

  it("allows optional snippet", () => {
    const evidence = {
      file: "src/routes/auth.ts",
      startLine: 10,
      endLine: 15,
      label: "Unprotected login endpoint",
    };

    const result = EvidenceItemSchema.safeParse(evidence);
    expect(result.success).toBe(true);
  });

  it("rejects invalid line numbers", () => {
    const evidence = {
      file: "src/routes/auth.ts",
      startLine: -1,
      endLine: 15,
      label: "Test",
    };

    const result = EvidenceItemSchema.safeParse(evidence);
    expect(result.success).toBe(false);
  });
});

describe("ClaimSchema", () => {
  it("validates a valid claim", () => {
    const claim = {
      type: "AUTH_ENFORCED",
      source: "comment",
      textEvidence: "// @auth required",
      location: {
        file: "src/middleware/auth.ts",
        startLine: 5,
        endLine: 5,
      },
      scope: "route",
      strength: "medium",
    };

    const result = ClaimSchema.safeParse(claim);
    expect(result.success).toBe(true);
  });

  it("rejects invalid claim type", () => {
    const claim = {
      type: "INVALID_TYPE",
      source: "comment",
      textEvidence: "test",
      location: { file: "test.ts", startLine: 1, endLine: 1 },
      scope: "route",
      strength: "medium",
    };

    const result = ClaimSchema.safeParse(claim);
    expect(result.success).toBe(false);
  });
});

describe("ProofTraceSchema", () => {
  it("validates a valid proof trace", () => {
    const proof = {
      summary: "Request flows from route to handler without auth middleware",
      nodes: [
        { kind: "route", label: "POST /api/users", file: "routes.ts", line: 42 },
        { kind: "handler", label: "createUser", file: "handlers.ts", line: 100 },
        { kind: "sink", label: "db.insert()" },
      ],
    };

    const result = ProofTraceSchema.safeParse(proof);
    expect(result.success).toBe(true);
  });

  it("allows nodes without file/line", () => {
    const proof = {
      summary: "Data flow trace",
      nodes: [{ kind: "function", label: "processInput" }],
    };

    const result = ProofTraceSchema.safeParse(proof);
    expect(result.success).toBe(true);
  });
});

describe("FindingSchema", () => {
  const validFinding: Finding = {
    id: "f-abc123",
    severity: "high",
    confidence: 0.85,
    category: "auth",
    ruleId: "VC-AUTH-001",
    title: "Missing authentication on sensitive endpoint",
    description:
      "The /api/admin endpoint lacks authentication middleware, allowing unauthorized access.",
    evidence: [
      {
        file: "src/routes/admin.ts",
        startLine: 25,
        endLine: 30,
        snippet: "app.get('/api/admin', adminHandler)",
        label: "Unprotected admin route",
      },
    ],
    remediation: {
      recommendedFix: "Add authentication middleware before the route handler",
      patch: `--- a/src/routes/admin.ts
+++ b/src/routes/admin.ts
@@ -25,1 +25,1 @@
-app.get('/api/admin', adminHandler)
+app.get('/api/admin', authMiddleware, adminHandler)`,
    },
    fingerprint: "sha256:abc123def456",
  };

  it("validates a valid finding", () => {
    const result = FindingSchema.safeParse(validFinding);
    expect(result.success).toBe(true);
  });

  it("validates finding with optional claim and proof", () => {
    const findingWithExtras: Finding = {
      ...validFinding,
      claim: {
        type: "AUTH_ENFORCED",
        source: "comment",
        textEvidence: "// TODO: add auth",
        location: { file: "src/routes/admin.ts", startLine: 24, endLine: 24 },
        scope: "route",
        strength: "weak",
      },
      proof: {
        summary: "Route handler called without auth check",
        nodes: [
          { kind: "route", label: "GET /api/admin" },
          { kind: "handler", label: "adminHandler" },
        ],
      },
      links: {
        owasp: "https://owasp.org/Top10/A01_2021-Broken_Access_Control/",
        cwe: "https://cwe.mitre.org/data/definitions/306.html",
      },
    };

    const result = FindingSchema.safeParse(findingWithExtras);
    expect(result.success).toBe(true);
  });

  it("rejects invalid ruleId format", () => {
    const invalid = { ...validFinding, ruleId: "INVALID" };
    const result = FindingSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects confidence outside 0-1 range", () => {
    const invalid = { ...validFinding, confidence: 1.5 };
    const result = FindingSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects empty evidence array", () => {
    const invalid = { ...validFinding, evidence: [] };
    const result = FindingSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("ScanArtifactSchema", () => {
  const validArtifact: ScanArtifact = {
    artifactVersion: "0.2",
    generatedAt: "2024-01-15T10:30:00.000Z",
    tool: {
      name: "vibecheck",
      version: "1.0.0",
    },
    summary: {
      totalFindings: 2,
      bySeverity: {
        critical: 0,
        high: 1,
        medium: 1,
        low: 0,
        info: 0,
      },
      byCategory: {
        auth: 1,
        validation: 1,
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
        id: "f-001",
        severity: "high",
        confidence: 0.9,
        category: "auth",
        ruleId: "VC-AUTH-001",
        title: "Missing authentication",
        description: "Endpoint lacks auth middleware",
        evidence: [
          {
            file: "routes.ts",
            startLine: 10,
            endLine: 10,
            label: "Unprotected route",
          },
        ],
        remediation: {
          recommendedFix: "Add auth middleware",
        },
        fingerprint: "fp-001",
      },
      {
        id: "f-002",
        severity: "medium",
        confidence: 0.75,
        category: "validation",
        ruleId: "VC-VAL-001",
        title: "Missing input validation",
        description: "User input not validated",
        evidence: [
          {
            file: "handlers.ts",
            startLine: 50,
            endLine: 55,
            label: "Raw input usage",
          },
        ],
        remediation: {
          recommendedFix: "Add Zod schema validation",
        },
        fingerprint: "fp-002",
      },
    ],
  };

  it("validates a minimal valid artifact", () => {
    const result = ScanArtifactSchema.safeParse(validArtifact);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.artifactVersion).toBe(ARTIFACT_VERSION);
    }
  });

  it("validates artifact with optional repo info", () => {
    const artifactWithRepo: ScanArtifact = {
      ...validArtifact,
      repo: {
        name: "my-project",
        rootPathHash: "sha256:abc123",
        git: {
          branch: "main",
          commit: "abc123def456",
          remoteUrl: "https://github.com/user/repo",
          isDirty: false,
        },
      },
    };

    const result = ScanArtifactSchema.safeParse(artifactWithRepo);
    expect(result.success).toBe(true);
  });

  it("validates artifact with optional maps and metrics", () => {
    const fullArtifact: ScanArtifact = {
      ...validArtifact,
      routeMap: [
        {
          routeId: "r-001",
          method: "GET",
          path: "/api/users",
          handler: "getUsers",
          file: "routes.ts",
          line: 10,
          middleware: ["auth", "rateLimit"],
        },
      ],
      middlewareMap: [
        {
          name: "auth",
          file: "middleware/auth.ts",
          line: 5,
          appliesTo: ["/api/*"],
        },
      ],
      metrics: {
        filesScanned: 50,
        linesOfCode: 5000,
        scanDurationMs: 1234.5,
        rulesExecuted: 25,
      },
    };

    const result = ScanArtifactSchema.safeParse(fullArtifact);
    expect(result.success).toBe(true);
  });

  it("rejects invalid artifact version", () => {
    const invalid = { ...validArtifact, artifactVersion: "2.0" };
    const result = ScanArtifactSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects invalid ISO date format", () => {
    const invalid = { ...validArtifact, generatedAt: "not-a-date" };
    const result = ScanArtifactSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("validateArtifact", () => {
  const validArtifact = {
    artifactVersion: "0.2",
    generatedAt: "2024-01-15T10:30:00.000Z",
    tool: { name: "vibecheck", version: "1.0.0" },
    summary: {
      totalFindings: 0,
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      byCategory: {
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
        other: 0,
      },
    },
    findings: [],
  };

  it("returns parsed artifact for valid input", () => {
    const result = validateArtifact(validArtifact);
    expect(result.artifactVersion).toBe("0.2");
    expect(result.tool.name).toBe("vibecheck");
  });

  it("throws ArtifactValidationError for invalid input", () => {
    expect(() => validateArtifact({})).toThrow(ArtifactValidationError);
  });

  it("includes path information in error message", () => {
    try {
      validateArtifact({ artifactVersion: "invalid" });
    } catch (e) {
      expect(e).toBeInstanceOf(ArtifactValidationError);
      expect((e as ArtifactValidationError).message).toContain("artifactVersion");
    }
  });
});

describe("safeValidateArtifact", () => {
  const validArtifact = {
    artifactVersion: "0.2",
    generatedAt: "2024-01-15T10:30:00.000Z",
    tool: { name: "vibecheck", version: "1.0.0" },
    summary: {
      totalFindings: 0,
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      byCategory: {
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
        other: 0,
      },
    },
    findings: [],
  };

  it("returns success result for valid input", () => {
    const result = safeValidateArtifact(validArtifact);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.artifactVersion).toBe("0.2");
    }
  });

  it("returns error result for invalid input", () => {
    const result = safeValidateArtifact({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ArtifactValidationError);
    }
  });
});

describe("computeSummary", () => {
  it("computes correct counts for empty findings", () => {
    const summary = computeSummary([]);
    expect(summary.totalFindings).toBe(0);
    expect(summary.bySeverity.critical).toBe(0);
    expect(summary.byCategory.auth).toBe(0);
  });

  it("computes correct counts for multiple findings", () => {
    const findings: Finding[] = [
      {
        id: "1",
        severity: "high",
        confidence: 0.9,
        category: "auth",
        ruleId: "VC-AUTH-001",
        title: "Test",
        description: "Test",
        evidence: [{ file: "a.ts", startLine: 1, endLine: 1, label: "test" }],
        remediation: { recommendedFix: "fix" },
        fingerprint: "fp1",
      },
      {
        id: "2",
        severity: "high",
        confidence: 0.8,
        category: "auth",
        ruleId: "VC-AUTH-002",
        title: "Test 2",
        description: "Test 2",
        evidence: [{ file: "b.ts", startLine: 1, endLine: 1, label: "test" }],
        remediation: { recommendedFix: "fix" },
        fingerprint: "fp2",
      },
      {
        id: "3",
        severity: "critical",
        confidence: 0.95,
        category: "injection",
        ruleId: "VC-INJ-001",
        title: "Test 3",
        description: "Test 3",
        evidence: [{ file: "c.ts", startLine: 1, endLine: 1, label: "test" }],
        remediation: { recommendedFix: "fix" },
        fingerprint: "fp3",
      },
    ];

    const summary = computeSummary(findings);
    expect(summary.totalFindings).toBe(3);
    expect(summary.bySeverity.high).toBe(2);
    expect(summary.bySeverity.critical).toBe(1);
    expect(summary.bySeverity.medium).toBe(0);
    expect(summary.byCategory.auth).toBe(2);
    expect(summary.byCategory.injection).toBe(1);
    expect(summary.byCategory.validation).toBe(0);
  });
});

describe("ARTIFACT_VERSION constant", () => {
  it("is set to 0.1", () => {
    expect(ARTIFACT_VERSION).toBe("0.2");
  });
});

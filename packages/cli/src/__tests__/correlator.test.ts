/**
 * Tests for Phase 4 Correlator - Cross-Pack Correlation Rules
 *
 * Tests verify:
 * 1. Each correlation rule triggers on appropriate fixtures
 * 2. Fingerprints are stable (deterministic)
 * 3. Findings are properly ordered
 * 4. Related findings are correctly linked
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { Finding, RouteMap, MiddlewareMap } from "@vibecheck/schema";
import {
  runCorrelationPass,
  shouldRunCorrelation,
  type CorrelationContext,
} from "../phase4/correlator.js";

// Helper to create a mock finding
function createMockFinding(overrides: Partial<Finding>): Finding {
  return {
    id: `f-${Math.random().toString(36).slice(2, 8)}`,
    ruleId: "VC-TEST-001",
    title: "Test Finding",
    description: "Test description",
    severity: "medium",
    confidence: 0.8,
    category: "auth",
    evidence: [
      {
        file: "app/api/test/route.ts",
        startLine: 1,
        endLine: 10,
        label: "Test evidence",
      },
    ],
    remediation: {
      recommendedFix: "Test fix",
    },
    fingerprint: `sha256:${Math.random().toString(36).slice(2, 18)}`,
    ...overrides,
  };
}

describe("Phase 4 Correlator", () => {
  describe("shouldRunCorrelation", () => {
    it("returns false for empty findings", () => {
      expect(shouldRunCorrelation([])).toBe(false);
    });

    it("returns true for non-empty findings", () => {
      expect(shouldRunCorrelation([createMockFinding({})])).toBe(true);
    });
  });

  describe("VC-CORR-001: Auth×Validation", () => {
    it("detects state-changing route with auth but missing validation", () => {
      const authFinding = createMockFinding({
        ruleId: "VC-AUTH-001",
        category: "auth",
        title: "Unprotected API Route",
        evidence: [
          {
            file: "app/api/users/route.ts",
            startLine: 5,
            endLine: 15,
            label: "POST handler without auth",
          },
        ],
        fingerprint: "sha256:auth001abc12345",
      });

      const routeMap: RouteMap = {
        routes: [
          {
            routeId: "POST-/api/users",
            method: "POST",
            path: "/api/users",
            file: "app/api/users/route.ts",
            startLine: 5,
            endLine: 15,
          },
        ],
      };

      const ctx: CorrelationContext = {
        findings: [authFinding],
        routeMap,
      };

      const result = runCorrelationPass(ctx);

      // Should produce a correlated finding
      const corrFindings = result.findings.filter(f => f.ruleId === "VC-CORR-001");
      expect(corrFindings.length).toBe(1);
      expect(corrFindings[0].title).toBe("Auth Check Without Input Validation");
      expect(corrFindings[0].relatedFindings).toContain("sha256:auth001abc12345");
      expect(corrFindings[0].correlationData?.pattern).toBe("auth_without_validation");
    });

    it("does not trigger when validation findings exist", () => {
      const authFinding = createMockFinding({
        ruleId: "VC-AUTH-001",
        category: "auth",
        evidence: [{ file: "app/api/users/route.ts", startLine: 5, endLine: 15, label: "Auth" }],
      });

      const validationFinding = createMockFinding({
        ruleId: "VC-VAL-001",
        category: "validation",
        evidence: [{ file: "app/api/users/route.ts", startLine: 10, endLine: 12, label: "Validation" }],
      });

      const routeMap: RouteMap = {
        routes: [
          {
            routeId: "POST-/api/users",
            method: "POST",
            path: "/api/users",
            file: "app/api/users/route.ts",
            startLine: 5,
            endLine: 15,
          },
        ],
      };

      const ctx: CorrelationContext = {
        findings: [authFinding, validationFinding],
        routeMap,
      };

      const result = runCorrelationPass(ctx);
      const corrFindings = result.findings.filter(f => f.ruleId === "VC-CORR-001");
      expect(corrFindings.length).toBe(0);
    });

    it("does not trigger for GET routes", () => {
      const authFinding = createMockFinding({
        ruleId: "VC-AUTH-001",
        category: "auth",
        evidence: [{ file: "app/api/users/route.ts", startLine: 5, endLine: 15, label: "Auth" }],
      });

      const routeMap: RouteMap = {
        routes: [
          {
            routeId: "GET-/api/users",
            method: "GET",
            path: "/api/users",
            file: "app/api/users/route.ts",
            startLine: 5,
            endLine: 15,
          },
        ],
      };

      const ctx: CorrelationContext = {
        findings: [authFinding],
        routeMap,
      };

      const result = runCorrelationPass(ctx);
      const corrFindings = result.findings.filter(f => f.ruleId === "VC-CORR-001");
      expect(corrFindings.length).toBe(0);
    });
  });

  describe("VC-CORR-002: Middleware×Upload", () => {
    it("detects upload endpoint not covered by middleware", () => {
      const uploadFinding = createMockFinding({
        ruleId: "VC-UPL-001",
        category: "uploads",
        title: "File upload without constraints",
        evidence: [
          {
            file: "app/api/upload/route.ts",
            startLine: 10,
            endLine: 20,
            label: "Upload handler",
          },
        ],
        fingerprint: "sha256:upload001def456",
      });

      const middlewareMap: MiddlewareMap = {
        matcher: ["/api/:path*"],
        coverage: [
          { routeId: "app/api/upload/route.ts", covered: false, reason: "Excluded by matcher" },
        ],
      };

      const ctx: CorrelationContext = {
        findings: [uploadFinding],
        middlewareMap,
      };

      const result = runCorrelationPass(ctx);

      const corrFindings = result.findings.filter(f => f.ruleId === "VC-CORR-002");
      expect(corrFindings.length).toBe(1);
      expect(corrFindings[0].title).toBe("Upload Endpoint Not Protected by Middleware");
      expect(corrFindings[0].severity).toBe("high");
      expect(corrFindings[0].relatedFindings).toContain("sha256:upload001def456");
    });

    it("does not trigger when upload route is covered", () => {
      const uploadFinding = createMockFinding({
        ruleId: "VC-UPL-001",
        category: "uploads",
        evidence: [{ file: "app/api/upload/route.ts", startLine: 10, endLine: 20, label: "Upload" }],
      });

      const middlewareMap: MiddlewareMap = {
        matcher: ["/api/:path*"],
        coverage: [
          { routeId: "app/api/upload/route.ts", covered: true },
        ],
      };

      const ctx: CorrelationContext = {
        findings: [uploadFinding],
        middlewareMap,
      };

      const result = runCorrelationPass(ctx);
      const corrFindings = result.findings.filter(f => f.ruleId === "VC-CORR-002");
      expect(corrFindings.length).toBe(0);
    });
  });

  describe("VC-CORR-003: Network×Auth", () => {
    it("detects SSRF with auth tokens in same file", () => {
      const ssrfFinding = createMockFinding({
        ruleId: "VC-NET-001",
        category: "network",
        title: "SSRF-prone fetch call",
        evidence: [
          {
            file: "app/api/proxy/route.ts",
            startLine: 15,
            endLine: 20,
            label: "fetch(body.url)",
          },
        ],
        fingerprint: "sha256:ssrf001ghi789",
      });

      const authFinding = createMockFinding({
        ruleId: "VC-AUTH-001",
        category: "auth",
        title: "Auth handling",
        evidence: [
          {
            file: "app/api/proxy/route.ts",
            startLine: 5,
            endLine: 10,
            label: "Session token",
          },
        ],
        fingerprint: "sha256:auth002jkl012",
      });

      const ctx: CorrelationContext = {
        findings: [ssrfFinding, authFinding],
      };

      const result = runCorrelationPass(ctx);

      const corrFindings = result.findings.filter(f => f.ruleId === "VC-CORR-003");
      expect(corrFindings.length).toBe(1);
      expect(corrFindings[0].title).toBe("Token May Be Forwarded to User-Controlled URL");
      expect(corrFindings[0].severity).toBe("critical");
      expect(corrFindings[0].relatedFindings).toContain("sha256:ssrf001ghi789");
      expect(corrFindings[0].relatedFindings).toContain("sha256:auth002jkl012");
    });

    it("does not trigger without both network and auth findings in same file", () => {
      const ssrfFinding = createMockFinding({
        ruleId: "VC-NET-001",
        category: "network",
        evidence: [{ file: "app/api/proxy/route.ts", startLine: 15, endLine: 20, label: "SSRF" }],
      });

      const authFinding = createMockFinding({
        ruleId: "VC-AUTH-001",
        category: "auth",
        evidence: [{ file: "app/api/users/route.ts", startLine: 5, endLine: 10, label: "Auth" }],
      });

      const ctx: CorrelationContext = {
        findings: [ssrfFinding, authFinding],
      };

      const result = runCorrelationPass(ctx);
      const corrFindings = result.findings.filter(f => f.ruleId === "VC-CORR-003");
      expect(corrFindings.length).toBe(0);
    });
  });

  describe("VC-CORR-004: Privacy×Logging", () => {
    it("detects sensitive logging in API route context", () => {
      const privacyFinding = createMockFinding({
        ruleId: "VC-PRIV-001",
        category: "privacy",
        title: "Sensitive data in logs: password",
        evidence: [
          {
            file: "app/api/login/route.ts",
            startLine: 25,
            endLine: 25,
            label: "console.log(password)",
          },
        ],
        fingerprint: "sha256:priv001mno345",
      });

      const routeMap: RouteMap = {
        routes: [
          {
            routeId: "POST-/api/login",
            method: "POST",
            path: "/api/login",
            file: "app/api/login/route.ts",
            startLine: 1,
            endLine: 50,
          },
        ],
      };

      const ctx: CorrelationContext = {
        findings: [privacyFinding],
        routeMap,
      };

      const result = runCorrelationPass(ctx);

      const corrFindings = result.findings.filter(f => f.ruleId === "VC-CORR-004");
      expect(corrFindings.length).toBe(1);
      expect(corrFindings[0].title).toBe("Sensitive Logging in Authenticated API Context");
      expect(corrFindings[0].severity).toBe("high");
      expect(corrFindings[0].relatedFindings).toContain("sha256:priv001mno345");
    });

    it("does not trigger for non-API route files", () => {
      const privacyFinding = createMockFinding({
        ruleId: "VC-PRIV-001",
        category: "privacy",
        evidence: [{ file: "lib/utils.ts", startLine: 25, endLine: 25, label: "Log" }],
      });

      const ctx: CorrelationContext = {
        findings: [privacyFinding],
        routeMap: { routes: [] },
      };

      const result = runCorrelationPass(ctx);
      const corrFindings = result.findings.filter(f => f.ruleId === "VC-CORR-004");
      expect(corrFindings.length).toBe(0);
    });
  });

  describe("VC-CORR-005: Crypto×Auth", () => {
    it("detects JWT decode without verify in auth context", () => {
      const jwtFinding = createMockFinding({
        ruleId: "VC-CRYPTO-002",
        category: "crypto",
        title: "JWT decoded without signature verification",
        evidence: [
          {
            file: "lib/auth/session.ts",
            startLine: 42,
            endLine: 42,
            label: "jwt.decode(token)",
          },
        ],
        fingerprint: "sha256:jwt001pqr678",
      });

      const ctx: CorrelationContext = {
        findings: [jwtFinding],
      };

      const result = runCorrelationPass(ctx);

      const corrFindings = result.findings.filter(f => f.ruleId === "VC-CORR-005");
      expect(corrFindings.length).toBe(1);
      expect(corrFindings[0].title).toBe("JWT Decode Without Verify on Auth Gate Path");
      expect(corrFindings[0].severity).toBe("critical");
      expect(corrFindings[0].relatedFindings).toContain("sha256:jwt001pqr678");
    });

    it("detects JWT decode in middleware file", () => {
      const jwtFinding = createMockFinding({
        ruleId: "VC-CRYPTO-002",
        category: "crypto",
        evidence: [{ file: "middleware.ts", startLine: 10, endLine: 10, label: "jwt.decode" }],
        fingerprint: "sha256:jwt002stu901",
      });

      const ctx: CorrelationContext = {
        findings: [jwtFinding],
      };

      const result = runCorrelationPass(ctx);
      const corrFindings = result.findings.filter(f => f.ruleId === "VC-CORR-005");
      expect(corrFindings.length).toBe(1);
    });

    it("does not trigger for non-auth context files", () => {
      const jwtFinding = createMockFinding({
        ruleId: "VC-CRYPTO-002",
        category: "crypto",
        evidence: [{ file: "lib/utils/format.ts", startLine: 10, endLine: 10, label: "jwt.decode" }],
      });

      const ctx: CorrelationContext = {
        findings: [jwtFinding],
      };

      const result = runCorrelationPass(ctx);
      const corrFindings = result.findings.filter(f => f.ruleId === "VC-CORR-005");
      expect(corrFindings.length).toBe(0);
    });
  });

  describe("VC-CORR-006: Hallucination×Coverage", () => {
    it("detects hallucination finding with proof trace gap", () => {
      const hallFinding = createMockFinding({
        ruleId: "VC-HALL-001",
        category: "hallucinations",
        title: "Unused security import",
        evidence: [
          {
            file: "app/api/secure/route.ts",
            startLine: 1,
            endLine: 1,
            label: "import { auth } from ...",
          },
        ],
        fingerprint: "sha256:hall001vwx234",
      });

      const routeMap: RouteMap = {
        routes: [
          {
            routeId: "POST-/api/secure",
            method: "POST",
            path: "/api/secure",
            file: "app/api/secure/route.ts",
            startLine: 5,
            endLine: 30,
          },
        ],
      };

      const proofTraces = {
        "POST-/api/secure": {
          summary: "No protection proven for this route",
          nodes: [],
        },
      };

      const ctx: CorrelationContext = {
        findings: [hallFinding],
        routeMap,
        proofTraces,
      };

      const result = runCorrelationPass(ctx);

      const corrFindings = result.findings.filter(f => f.ruleId === "VC-CORR-006");
      expect(corrFindings.length).toBe(1);
      expect(corrFindings[0].title).toBe("Security Claim Contradicts Proof Trace");
      expect(corrFindings[0].severity).toBe("high");
      expect(corrFindings[0].relatedFindings).toContain("sha256:hall001vwx234");
    });

    it("does not trigger when proof trace shows protection", () => {
      const hallFinding = createMockFinding({
        ruleId: "VC-HALL-001",
        category: "hallucinations",
        evidence: [{ file: "app/api/secure/route.ts", startLine: 1, endLine: 1, label: "Hall" }],
      });

      const routeMap: RouteMap = {
        routes: [
          {
            routeId: "POST-/api/secure",
            method: "POST",
            path: "/api/secure",
            file: "app/api/secure/route.ts",
            startLine: 5,
            endLine: 30,
          },
        ],
      };

      const proofTraces = {
        "POST-/api/secure": {
          summary: "Auth proven via getServerSession call",
          nodes: [{ kind: "auth", label: "getServerSession" }],
        },
      };

      const ctx: CorrelationContext = {
        findings: [hallFinding],
        routeMap,
        proofTraces,
      };

      const result = runCorrelationPass(ctx);
      const corrFindings = result.findings.filter(f => f.ruleId === "VC-CORR-006");
      expect(corrFindings.length).toBe(0);
    });
  });

  describe("Determinism", () => {
    it("produces stable fingerprints across multiple runs", () => {
      const authFinding = createMockFinding({
        ruleId: "VC-AUTH-001",
        category: "auth",
        evidence: [{ file: "app/api/users/route.ts", startLine: 5, endLine: 15, label: "Auth" }],
        fingerprint: "sha256:stablefingerprint",
      });

      const routeMap: RouteMap = {
        routes: [
          {
            routeId: "POST-/api/users",
            method: "POST",
            path: "/api/users",
            file: "app/api/users/route.ts",
            startLine: 5,
            endLine: 15,
          },
        ],
      };

      const ctx: CorrelationContext = {
        findings: [authFinding],
        routeMap,
      };

      // Run correlation pass twice
      const result1 = runCorrelationPass(ctx);
      const result2 = runCorrelationPass(ctx);

      // Get correlated findings only
      const corr1 = result1.findings.filter(f => f.ruleId.startsWith("VC-CORR"));
      const corr2 = result2.findings.filter(f => f.ruleId.startsWith("VC-CORR"));

      expect(corr1.length).toBe(corr2.length);

      // Fingerprints should be identical
      const fps1 = corr1.map(f => f.fingerprint).sort();
      const fps2 = corr2.map(f => f.fingerprint).sort();
      expect(fps1).toEqual(fps2);

      // IDs should be identical
      const ids1 = corr1.map(f => f.id).sort();
      const ids2 = corr2.map(f => f.id).sort();
      expect(ids1).toEqual(ids2);
    });

    it("produces stable ordering across multiple runs", () => {
      // Create multiple findings that will produce multiple correlations
      const findings: Finding[] = [
        createMockFinding({
          ruleId: "VC-AUTH-001",
          category: "auth",
          evidence: [{ file: "app/api/a/route.ts", startLine: 5, endLine: 15, label: "Auth" }],
          fingerprint: "sha256:authA",
        }),
        createMockFinding({
          ruleId: "VC-AUTH-001",
          category: "auth",
          evidence: [{ file: "app/api/b/route.ts", startLine: 5, endLine: 15, label: "Auth" }],
          fingerprint: "sha256:authB",
        }),
        createMockFinding({
          ruleId: "VC-PRIV-001",
          category: "privacy",
          evidence: [{ file: "app/api/c/route.ts", startLine: 10, endLine: 10, label: "Privacy" }],
          fingerprint: "sha256:privC",
        }),
      ];

      const routeMap: RouteMap = {
        routes: [
          { routeId: "POST-/api/a", method: "POST", path: "/api/a", file: "app/api/a/route.ts", startLine: 1, endLine: 20 },
          { routeId: "POST-/api/b", method: "POST", path: "/api/b", file: "app/api/b/route.ts", startLine: 1, endLine: 20 },
          { routeId: "POST-/api/c", method: "POST", path: "/api/c", file: "app/api/c/route.ts", startLine: 1, endLine: 20 },
        ],
      };

      const ctx: CorrelationContext = {
        findings,
        routeMap,
      };

      // Run multiple times
      const results = Array.from({ length: 5 }, () => runCorrelationPass(ctx));

      // All results should have same ordering
      const orderedFindings = results.map(r =>
        r.findings.filter(f => f.ruleId.startsWith("VC-CORR")).map(f => f.ruleId + ":" + f.evidence[0]?.file)
      );

      for (let i = 1; i < orderedFindings.length; i++) {
        expect(orderedFindings[i]).toEqual(orderedFindings[0]);
      }
    });
  });

  describe("Correlation Summary", () => {
    it("produces correct summary statistics", () => {
      const findings: Finding[] = [
        createMockFinding({
          ruleId: "VC-AUTH-001",
          category: "auth",
          evidence: [{ file: "app/api/users/route.ts", startLine: 5, endLine: 15, label: "Auth" }],
        }),
        createMockFinding({
          ruleId: "VC-PRIV-001",
          category: "privacy",
          evidence: [{ file: "app/api/users/route.ts", startLine: 20, endLine: 20, label: "Privacy" }],
        }),
      ];

      const routeMap: RouteMap = {
        routes: [
          { routeId: "POST-/api/users", method: "POST", path: "/api/users", file: "app/api/users/route.ts", startLine: 1, endLine: 30 },
        ],
      };

      const ctx: CorrelationContext = {
        findings,
        routeMap,
      };

      const result = runCorrelationPass(ctx);

      expect(result.correlationSummary.totalCorrelations).toBeGreaterThanOrEqual(0);
      expect(typeof result.correlationSummary.correlationDurationMs).toBe("number");
      expect(result.correlationSummary.byPattern).toBeDefined();
    });

    it("builds graph with nodes and edges", () => {
      const authFinding = createMockFinding({
        ruleId: "VC-AUTH-001",
        category: "auth",
        evidence: [{ file: "app/api/users/route.ts", startLine: 5, endLine: 15, label: "Auth" }],
        fingerprint: "sha256:graphtest",
      });

      const routeMap: RouteMap = {
        routes: [
          { routeId: "POST-/api/users", method: "POST", path: "/api/users", file: "app/api/users/route.ts", startLine: 5, endLine: 15 },
        ],
      };

      const ctx: CorrelationContext = {
        findings: [authFinding],
        routeMap,
      };

      const result = runCorrelationPass(ctx);

      expect(result.graph).toBeDefined();
      expect(result.graph?.nodes.length).toBeGreaterThan(0);

      // Should have route node
      const routeNodes = result.graph?.nodes.filter(n => n.type === "route");
      expect(routeNodes?.length).toBe(1);

      // Should have finding nodes
      const findingNodes = result.graph?.nodes.filter(n => n.type === "finding");
      expect(findingNodes?.length).toBeGreaterThan(0);
    });
  });

  describe("Related Findings", () => {
    it("links related findings by fingerprint", () => {
      const authFinding = createMockFinding({
        ruleId: "VC-AUTH-001",
        category: "auth",
        evidence: [{ file: "app/api/users/route.ts", startLine: 5, endLine: 15, label: "Auth" }],
        fingerprint: "sha256:linkedfinding123",
      });

      const routeMap: RouteMap = {
        routes: [
          { routeId: "POST-/api/users", method: "POST", path: "/api/users", file: "app/api/users/route.ts", startLine: 5, endLine: 15 },
        ],
      };

      const ctx: CorrelationContext = {
        findings: [authFinding],
        routeMap,
      };

      const result = runCorrelationPass(ctx);
      const corrFindings = result.findings.filter(f => f.ruleId.startsWith("VC-CORR"));

      for (const corr of corrFindings) {
        expect(corr.relatedFindings).toBeDefined();
        expect(corr.relatedFindings?.length).toBeGreaterThan(0);
        expect(corr.correlationData?.relatedFindingIds).toBeDefined();
        expect(corr.correlationData?.relatedFindingIds).toEqual(corr.relatedFindings);
      }
    });
  });
});

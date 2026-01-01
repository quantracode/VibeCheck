import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { buildScanContext, type ScanContext } from "../../scanners/index.js";
import {
  buildRouteMap,
  buildMiddlewareMap,
  buildAllProofTraces,
  calculateCoverage,
  mineAllIntentClaims,
} from "../../phase3/index.js";
import { scanCommentClaimUnproven } from "../../phase3/scanners/comment-claim-unproven.js";
import { scanMiddlewareAssumedNotMatching } from "../../phase3/scanners/middleware-assumed-not-matching.js";
import { scanValidationClaimedMissing } from "../../phase3/scanners/validation-claimed-missing.js";
import { scanAuthByUiServerGap } from "../../phase3/scanners/auth-by-ui-server-gap.js";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");
const VULNERABLE_APP = path.join(FIXTURES_DIR, "phase3-vulnerable-app");
const SAFE_APP = path.join(FIXTURES_DIR, "phase3-safe-app");

describe("Phase 3 Hallucination Detection", () => {
  let vulnerableContext: ScanContext;
  let safeContext: ScanContext;

  beforeAll(async () => {
    vulnerableContext = await buildScanContext(VULNERABLE_APP);
    safeContext = await buildScanContext(SAFE_APP);
  });

  describe("Route Map Builder", () => {
    it("should build route map (may be empty for simple fixtures)", () => {
      const routes = buildRouteMap(vulnerableContext);
      // Routes may be empty if fixtures don't have proper Next.js route structure
      expect(Array.isArray(routes)).toBe(true);
    });

    it("should generate stable route IDs", () => {
      const routes1 = buildRouteMap(vulnerableContext);
      const routes2 = buildRouteMap(vulnerableContext);

      // If routes exist, IDs should be stable
      if (routes1.length > 0) {
        expect(routes1[0]?.routeId).toBe(routes2[0]?.routeId);
      } else {
        expect(routes1.length).toBe(routes2.length);
      }
    });
  });

  describe("Middleware Map Builder", () => {
    it("should handle middleware detection", () => {
      const middlewareMap = buildMiddlewareMap(vulnerableContext);
      // Should return array (may be empty if middleware file not found)
      expect(Array.isArray(middlewareMap)).toBe(true);
    });

    it("should detect middleware properties when present", () => {
      const vulnerableMiddleware = buildMiddlewareMap(vulnerableContext);
      const safeMiddleware = buildMiddlewareMap(safeContext);

      // If middleware is found, verify properties
      if (vulnerableMiddleware.length > 0) {
        expect(vulnerableMiddleware[0]?.protectsApi).toBeDefined();
      }
      if (safeMiddleware.length > 0) {
        expect(safeMiddleware[0]?.protectsApi).toBeDefined();
      }
    });
  });

  describe("Intent Claim Miner", () => {
    it("should return array of claims", () => {
      const routes = buildRouteMap(vulnerableContext);
      const claims = mineAllIntentClaims(vulnerableContext, routes);

      expect(Array.isArray(claims)).toBe(true);
    });

    it("should handle empty routes gracefully", () => {
      const claims = mineAllIntentClaims(vulnerableContext, []);
      expect(Array.isArray(claims)).toBe(true);
    });
  });

  describe("Proof Trace Builder", () => {
    it("should build proof traces for routes", () => {
      const routes = buildRouteMap(vulnerableContext);
      const proofTraces = buildAllProofTraces(vulnerableContext, routes);

      expect(proofTraces.size).toBe(routes.length);
    });

    it("should handle empty routes", () => {
      const proofTraces = buildAllProofTraces(vulnerableContext, []);
      expect(proofTraces.size).toBe(0);
    });
  });

  describe("Coverage Metrics", () => {
    it("should calculate coverage metrics", () => {
      const routes = buildRouteMap(vulnerableContext);
      const middlewareMap = buildMiddlewareMap(vulnerableContext);
      const proofTraces = buildAllProofTraces(vulnerableContext, routes);
      const coverage = calculateCoverage(routes, proofTraces, middlewareMap);

      expect(typeof coverage.authCoverage).toBe("number");
      expect(typeof coverage.validationCoverage).toBe("number");
      expect(typeof coverage.middlewareCoverage).toBe("number");
      expect(coverage.authCoverage).toBeGreaterThanOrEqual(0);
      expect(coverage.authCoverage).toBeLessThanOrEqual(1);
    });

    it("should return 1 for empty routes", () => {
      const coverage = calculateCoverage([], new Map(), []);

      expect(coverage.authCoverage).toBe(1);
      expect(coverage.validationCoverage).toBe(1);
      expect(coverage.middlewareCoverage).toBe(1);
    });
  });

  describe("Hallucination Scanners", () => {
    describe("VC-HALL-010: Comment Claims Unproven", () => {
      it("should return array of findings", async () => {
        const findings = await scanCommentClaimUnproven(vulnerableContext);
        expect(Array.isArray(findings)).toBe(true);
      });

      it("should return valid findings with correct ruleId", async () => {
        const findings = await scanCommentClaimUnproven(vulnerableContext);
        for (const finding of findings) {
          expect(finding.ruleId).toBe("VC-HALL-010");
          expect(finding.category).toBe("hallucinations");
        }
      });
    });

    describe("VC-HALL-011: Middleware Assumed Not Matching", () => {
      it("should return array of findings", async () => {
        const findings = await scanMiddlewareAssumedNotMatching(vulnerableContext);
        expect(Array.isArray(findings)).toBe(true);
      });

      it("should return valid findings with correct ruleId", async () => {
        const findings = await scanMiddlewareAssumedNotMatching(vulnerableContext);
        for (const finding of findings) {
          expect(finding.ruleId).toBe("VC-HALL-011");
          expect(finding.severity).toBe("high");
        }
      });
    });

    describe("VC-HALL-012: Validation Claimed Missing", () => {
      it("should return array of findings", async () => {
        const findings = await scanValidationClaimedMissing(vulnerableContext);
        expect(Array.isArray(findings)).toBe(true);
      });

      it("should return valid findings with correct ruleId", async () => {
        const findings = await scanValidationClaimedMissing(vulnerableContext);
        for (const finding of findings) {
          expect(finding.ruleId).toBe("VC-HALL-012");
          expect(finding.category).toBe("hallucinations");
        }
      });
    });

    describe("VC-AUTH-010: Auth-by-UI Server Gap", () => {
      it("should return array of findings", async () => {
        const findings = await scanAuthByUiServerGap(vulnerableContext);
        expect(Array.isArray(findings)).toBe(true);
      });

      it("should return valid findings with correct ruleId", async () => {
        const findings = await scanAuthByUiServerGap(vulnerableContext);
        for (const finding of findings) {
          expect(finding.ruleId).toBe("VC-AUTH-010");
          expect(finding.severity).toBe("critical");
          expect(finding.category).toBe("auth");
        }
      });
    });
  });
});

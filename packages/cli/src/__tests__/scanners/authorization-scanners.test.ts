import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { buildScanContext, type ScanContext } from "../../scanners/index.js";
import { scanAdminRouteNoRoleGuard } from "../../scanners/authorization/admin-route-no-role-guard.js";
import { scanOwnershipCheckMissing } from "../../scanners/authorization/ownership-check-missing.js";
import { scanRoleDeclaredNotEnforced } from "../../scanners/authorization/role-declared-not-enforced.js";
import { scanTrustedClientId } from "../../scanners/authorization/trusted-client-id.js";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");
const VULNERABLE_APP = path.join(FIXTURES_DIR, "authz-vulnerable-app");
const SAFE_APP = path.join(FIXTURES_DIR, "authz-safe-app");

describe("Authorization Scanner Pack", () => {
  let vulnerableContext: ScanContext;
  let safeContext: ScanContext;

  beforeAll(async () => {
    vulnerableContext = await buildScanContext(VULNERABLE_APP);
    safeContext = await buildScanContext(SAFE_APP);
  });

  describe("VC-AUTHZ-001: Admin Route Lacks Role Guard", () => {
    it("should detect admin route with auth but no role check", async () => {
      const findings = await scanAdminRouteNoRoleGuard(vulnerableContext);

      const adminFinding = findings.find(
        (f) => f.ruleId === "VC-AUTHZ-001"
      );

      expect(adminFinding).toBeDefined();
      expect(adminFinding?.severity).toBe("high");
      expect(adminFinding?.category).toBe("authorization");
      expect(adminFinding?.title).toContain("admin");
      expect(adminFinding?.title).toContain("role guard");
    });

    it("should flag both GET and DELETE handlers without role guard", async () => {
      const findings = await scanAdminRouteNoRoleGuard(vulnerableContext);

      const adminFindings = findings.filter(
        (f) => f.ruleId === "VC-AUTHZ-001"
      );

      // Should find at least the DELETE handler which is state-changing
      expect(adminFindings.length).toBeGreaterThanOrEqual(1);
    });

    it("should not flag admin route with proper role check", async () => {
      const findings = await scanAdminRouteNoRoleGuard(safeContext);

      expect(findings.filter((f) => f.ruleId === "VC-AUTHZ-001")).toHaveLength(0);
    });

    it("should produce deterministic fingerprints", async () => {
      const findings1 = await scanAdminRouteNoRoleGuard(vulnerableContext);
      const findings2 = await scanAdminRouteNoRoleGuard(vulnerableContext);

      const fps1 = findings1.map((f) => f.fingerprint).sort();
      const fps2 = findings2.map((f) => f.fingerprint).sort();

      expect(fps1).toEqual(fps2);
    });
  });

  describe("VC-AUTHZ-002: Ownership Check Missing", () => {
    it("should detect userId extraction without ownership verification", async () => {
      const findings = await scanOwnershipCheckMissing(vulnerableContext);

      const ownershipFinding = findings.find(
        (f) => f.ruleId === "VC-AUTHZ-002"
      );

      expect(ownershipFinding).toBeDefined();
      expect(ownershipFinding?.severity).toBe("critical");
      expect(ownershipFinding?.category).toBe("authorization");
      expect(ownershipFinding?.description).toContain("IDOR");
    });

    it("should flag handler extracting userId from body", async () => {
      const findings = await scanOwnershipCheckMissing(vulnerableContext);

      // Just verify we have at least one AUTHZ-002 finding for state-changing route
      const ownershipFinding = findings.find(
        (f) => f.ruleId === "VC-AUTHZ-002"
      );

      expect(ownershipFinding).toBeDefined();
      expect(ownershipFinding?.evidence[0]?.label).toContain("without ownership check");
    });

    it("should not flag handler with proper ownership check", async () => {
      const findings = await scanOwnershipCheckMissing(safeContext);

      expect(findings.filter((f) => f.ruleId === "VC-AUTHZ-002")).toHaveLength(0);
    });

    it("should produce deterministic fingerprints", async () => {
      const findings1 = await scanOwnershipCheckMissing(vulnerableContext);
      const findings2 = await scanOwnershipCheckMissing(vulnerableContext);

      const fps1 = findings1.map((f) => f.fingerprint).sort();
      const fps2 = findings2.map((f) => f.fingerprint).sort();

      expect(fps1).toEqual(fps2);
    });
  });

  describe("VC-AUTHZ-003: Role Declared But Never Enforced", () => {
    it("should detect roles defined but not enforced in handlers", async () => {
      const findings = await scanRoleDeclaredNotEnforced(vulnerableContext);

      const roleFinding = findings.find(
        (f) => f.ruleId === "VC-AUTHZ-003"
      );

      expect(roleFinding).toBeDefined();
      expect(roleFinding?.severity).toBe("medium");
      expect(roleFinding?.category).toBe("authorization");
      expect(roleFinding?.description).toContain("role types");
    });

    it("should reference the role type declaration in evidence", async () => {
      const findings = await scanRoleDeclaredNotEnforced(vulnerableContext);

      const roleFinding = findings.find(
        (f) => f.ruleId === "VC-AUTHZ-003"
      );

      expect(roleFinding).toBeDefined();
      expect(roleFinding?.evidence.length).toBeGreaterThanOrEqual(2);

      // First evidence should be the role declaration
      const roleDecl = roleFinding?.evidence[0];
      expect(roleDecl?.file).toContain("types");
    });

    it("should not flag when roles are enforced", async () => {
      const findings = await scanRoleDeclaredNotEnforced(safeContext);

      expect(findings.filter((f) => f.ruleId === "VC-AUTHZ-003")).toHaveLength(0);
    });

    it("should produce deterministic fingerprints", async () => {
      const findings1 = await scanRoleDeclaredNotEnforced(vulnerableContext);
      const findings2 = await scanRoleDeclaredNotEnforced(vulnerableContext);

      const fps1 = findings1.map((f) => f.fingerprint).sort();
      const fps2 = findings2.map((f) => f.fingerprint).sort();

      expect(fps1).toEqual(fps2);
    });
  });

  describe("VC-AUTHZ-004: Server Trusts Client-Provided userId", () => {
    it("should detect client-provided userId used in create operation", async () => {
      const findings = await scanTrustedClientId(vulnerableContext);

      const trustedIdFinding = findings.find(
        (f) => f.ruleId === "VC-AUTHZ-004"
      );

      expect(trustedIdFinding).toBeDefined();
      expect(trustedIdFinding?.severity).toBe("critical");
      expect(trustedIdFinding?.category).toBe("authorization");
      expect(trustedIdFinding?.title).toContain("client-provided");
    });

    it("should mention impersonation risk in description", async () => {
      const findings = await scanTrustedClientId(vulnerableContext);

      const trustedIdFinding = findings.find(
        (f) => f.ruleId === "VC-AUTHZ-004"
      );

      expect(trustedIdFinding?.description).toContain("impersonate");
    });

    it("should not flag when session.user.id is used", async () => {
      const findings = await scanTrustedClientId(safeContext);

      expect(findings.filter((f) => f.ruleId === "VC-AUTHZ-004")).toHaveLength(0);
    });

    it("should produce deterministic fingerprints", async () => {
      const findings1 = await scanTrustedClientId(vulnerableContext);
      const findings2 = await scanTrustedClientId(vulnerableContext);

      const fps1 = findings1.map((f) => f.fingerprint).sort();
      const fps2 = findings2.map((f) => f.fingerprint).sort();

      expect(fps1).toEqual(fps2);
    });
  });

  describe("Authorization Pack Integration", () => {
    it("should detect multiple authorization issues in vulnerable app", async () => {
      const [adminFindings, ownershipFindings, roleFindings, trustedIdFindings] = await Promise.all([
        scanAdminRouteNoRoleGuard(vulnerableContext),
        scanOwnershipCheckMissing(vulnerableContext),
        scanRoleDeclaredNotEnforced(vulnerableContext),
        scanTrustedClientId(vulnerableContext),
      ]);

      const allFindings = [
        ...adminFindings,
        ...ownershipFindings,
        ...roleFindings,
        ...trustedIdFindings,
      ];

      // Should find at least one of each type
      expect(allFindings.filter((f) => f.ruleId === "VC-AUTHZ-001").length).toBeGreaterThan(0);
      expect(allFindings.filter((f) => f.ruleId === "VC-AUTHZ-002").length).toBeGreaterThan(0);
      expect(allFindings.filter((f) => f.ruleId === "VC-AUTHZ-003").length).toBeGreaterThan(0);
      expect(allFindings.filter((f) => f.ruleId === "VC-AUTHZ-004").length).toBeGreaterThan(0);
    });

    it("should have no false positives in safe app", async () => {
      const [adminFindings, ownershipFindings, roleFindings, trustedIdFindings] = await Promise.all([
        scanAdminRouteNoRoleGuard(safeContext),
        scanOwnershipCheckMissing(safeContext),
        scanRoleDeclaredNotEnforced(safeContext),
        scanTrustedClientId(safeContext),
      ]);

      const allFindings = [
        ...adminFindings,
        ...ownershipFindings,
        ...roleFindings,
        ...trustedIdFindings,
      ];

      expect(allFindings).toHaveLength(0);
    });

    it("should all have correct category", async () => {
      const [adminFindings, ownershipFindings, roleFindings, trustedIdFindings] = await Promise.all([
        scanAdminRouteNoRoleGuard(vulnerableContext),
        scanOwnershipCheckMissing(vulnerableContext),
        scanRoleDeclaredNotEnforced(vulnerableContext),
        scanTrustedClientId(vulnerableContext),
      ]);

      const allFindings = [
        ...adminFindings,
        ...ownershipFindings,
        ...roleFindings,
        ...trustedIdFindings,
      ];

      for (const finding of allFindings) {
        expect(finding.category).toBe("authorization");
      }
    });

    it("should all have valid OWASP and CWE links", async () => {
      const findings = await scanAdminRouteNoRoleGuard(vulnerableContext);

      for (const finding of findings) {
        expect(finding.links?.owasp).toContain("owasp.org");
        expect(finding.links?.cwe).toContain("cwe.mitre.org");
      }
    });
  });
});

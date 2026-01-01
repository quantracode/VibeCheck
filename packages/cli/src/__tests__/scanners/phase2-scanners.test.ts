import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { buildScanContext, type ScanContext } from "../../scanners/index.js";
import { scanOpenRedirect } from "../../scanners/network/open-redirect.js";
import { scanCorsMisconfiguration } from "../../scanners/network/cors-misconfiguration.js";
import { scanMissingTimeout } from "../../scanners/network/missing-timeout.js";
import { scanOverBroadResponse } from "../../scanners/privacy/over-broad-response.js";
import { scanMathRandomTokens } from "../../scanners/crypto/math-random-tokens.js";
import { scanJwtDecodeUnverified } from "../../scanners/crypto/jwt-decode-unverified.js";
import { scanWeakHashing } from "../../scanners/crypto/weak-hashing.js";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");
const VULNERABLE_APP = path.join(FIXTURES_DIR, "phase2-vulnerable-app");
const SAFE_APP = path.join(FIXTURES_DIR, "phase2-safe-app");

describe("Phase 2 Scanner Packs", () => {
  let vulnerableContext: ScanContext;
  let safeContext: ScanContext;

  beforeAll(async () => {
    vulnerableContext = await buildScanContext(VULNERABLE_APP);
    safeContext = await buildScanContext(SAFE_APP);
  });

  describe("Network Pack Phase 2", () => {
    describe("VC-NET-002: Open Redirect", () => {
      it("should detect user-controlled redirect", async () => {
        const findings = await scanOpenRedirect(vulnerableContext);

        const openRedirectFinding = findings.find(
          (f) => f.ruleId === "VC-NET-002"
        );

        expect(openRedirectFinding).toBeDefined();
        expect(openRedirectFinding?.severity).toBe("high");
        expect(openRedirectFinding?.category).toBe("network");
      });
    });

    describe("VC-NET-003: CORS Misconfiguration", () => {
      it("should detect wildcard origin with credentials", async () => {
        const findings = await scanCorsMisconfiguration(vulnerableContext);

        const corsFinding = findings.find(
          (f) => f.ruleId === "VC-NET-003"
        );

        expect(corsFinding).toBeDefined();
        expect(corsFinding?.severity).toBe("high");
      });
    });

    describe("VC-NET-004: Missing Timeout", () => {
      it("should detect fetch without timeout", async () => {
        const findings = await scanMissingTimeout(vulnerableContext);

        const timeoutFinding = findings.find(
          (f) => f.ruleId === "VC-NET-004"
        );

        expect(timeoutFinding).toBeDefined();
        expect(timeoutFinding?.severity).toBe("low");
      });

      it("should not flag fetch with AbortController", async () => {
        const findings = await scanMissingTimeout(safeContext);

        expect(findings).toHaveLength(0);
      });
    });
  });

  describe("Privacy Pack Phase 2", () => {
    describe("VC-PRIV-002: Over-broad Response", () => {
      it("should detect Prisma query without select", async () => {
        const findings = await scanOverBroadResponse(vulnerableContext);

        const overBroadFinding = findings.find(
          (f) => f.ruleId === "VC-PRIV-002"
        );

        expect(overBroadFinding).toBeDefined();
        expect(overBroadFinding?.category).toBe("privacy");
      });

      it("should not flag Prisma query with select", async () => {
        const findings = await scanOverBroadResponse(safeContext);

        expect(findings).toHaveLength(0);
      });
    });
  });

  describe("Crypto Pack", () => {
    describe("VC-CRYPTO-001: Math.random Tokens", () => {
      it("should detect Math.random for token generation", async () => {
        const findings = await scanMathRandomTokens(vulnerableContext);

        const randomFinding = findings.find(
          (f) => f.ruleId === "VC-CRYPTO-001"
        );

        expect(randomFinding).toBeDefined();
        expect(randomFinding?.severity).toBe("high");
        expect(randomFinding?.category).toBe("crypto");
      });

      it("should not flag crypto.randomBytes", async () => {
        const findings = await scanMathRandomTokens(safeContext);

        expect(findings).toHaveLength(0);
      });
    });

    describe("VC-CRYPTO-002: JWT Decode Unverified", () => {
      it("should detect jwt.decode without verify", async () => {
        const findings = await scanJwtDecodeUnverified(vulnerableContext);

        const jwtFinding = findings.find(
          (f) => f.ruleId === "VC-CRYPTO-002"
        );

        expect(jwtFinding).toBeDefined();
        expect(jwtFinding?.severity).toBe("critical");
      });

      it("should not flag jwt.verify usage", async () => {
        const findings = await scanJwtDecodeUnverified(safeContext);

        expect(findings).toHaveLength(0);
      });
    });

    describe("VC-CRYPTO-003: Weak Hashing", () => {
      it("should detect MD5 for passwords", async () => {
        const findings = await scanWeakHashing(vulnerableContext);

        const hashFinding = findings.find(
          (f) => f.ruleId === "VC-CRYPTO-003" && f.title.toLowerCase().includes("md5")
        );

        expect(hashFinding).toBeDefined();
        expect(hashFinding?.category).toBe("crypto");
      });

      it("should not flag bcrypt with proper salt rounds", async () => {
        const findings = await scanWeakHashing(safeContext);

        expect(findings).toHaveLength(0);
      });
    });
  });
});

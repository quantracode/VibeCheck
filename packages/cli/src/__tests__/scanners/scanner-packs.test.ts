import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { buildScanContext, type ScanContext } from "../../scanners/index.js";
import { scanUnprotectedApiRoutes } from "../../scanners/auth/unprotected-api-route.js";
import { scanMiddlewareGap, parseMatcherConfig, matcherCoversApi } from "../../scanners/auth/middleware-gap.js";
import { scanInsecureDefaults } from "../../scanners/config/insecure-defaults.js";
import { scanSensitiveLogging } from "../../scanners/privacy/sensitive-logging.js";
import {
  scanUnusedSecurityImports,
  findSecurityImports,
  checkIdentifierUsage,
} from "../../scanners/hallucinations/unused-security-imports.js";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");
const VULNERABLE_APP = path.join(FIXTURES_DIR, "vulnerable-app");
const SAFE_APP = path.join(FIXTURES_DIR, "safe-app");

describe("Scanner Packs", () => {
  let vulnerableContext: ScanContext;
  let safeContext: ScanContext;

  beforeAll(async () => {
    vulnerableContext = await buildScanContext(VULNERABLE_APP);
    safeContext = await buildScanContext(SAFE_APP);
  });

  describe("Auth Pack", () => {
    describe("VC-AUTH-001: Unprotected API Routes", () => {
      it("should detect unprotected POST handler with database writes", async () => {
        const findings = await scanUnprotectedApiRoutes(vulnerableContext);

        const postFinding = findings.find(
          (f) => f.ruleId === "VC-AUTH-001" && f.title.includes("POST")
        );

        expect(postFinding).toBeDefined();
        expect(postFinding?.severity).toBe("high");
        expect(postFinding?.category).toBe("auth");
      });

      it("should detect unprotected DELETE handler as critical", async () => {
        const findings = await scanUnprotectedApiRoutes(vulnerableContext);

        const deleteFinding = findings.find(
          (f) => f.ruleId === "VC-AUTH-001" && f.title.includes("DELETE")
        );

        expect(deleteFinding).toBeDefined();
        expect(deleteFinding?.severity).toBe("critical");
      });

      it("should not flag protected routes", async () => {
        const findings = await scanUnprotectedApiRoutes(safeContext);

        expect(findings).toHaveLength(0);
      });
    });

    describe("Middleware Gap Detection", () => {
      it("should parse single string matcher", () => {
        const content = `export const config = { matcher: '/api/:path*' }`;
        const matchers = parseMatcherConfig(content);

        expect(matchers).toEqual(["/api/:path*"]);
      });

      it("should parse array matcher", () => {
        const content = `export const config = { matcher: ['/api/:path*', '/admin/:path*'] }`;
        const matchers = parseMatcherConfig(content);

        expect(matchers).toEqual(["/api/:path*", "/admin/:path*"]);
      });

      it("should detect when matcher covers api", () => {
        expect(matcherCoversApi(["/api/:path*"])).toBe(true);
        expect(matcherCoversApi(["/api/users"])).toBe(true);
        expect(matcherCoversApi(["/:path*"])).toBe(true);
      });

      it("should detect when matcher does not cover api", () => {
        expect(matcherCoversApi(["/dashboard/:path*"])).toBe(false);
        expect(matcherCoversApi(["/admin/:path*"])).toBe(false);
      });
    });
  });

  describe("Config Pack", () => {
    describe("VC-CONFIG-002: Insecure Defaults", () => {
      it("should detect insecure default for JWT_SECRET", async () => {
        const findings = await scanInsecureDefaults(vulnerableContext);

        const jwtFinding = findings.find(
          (f) => f.ruleId === "VC-CONFIG-002" && f.title.includes("JWT_SECRET")
        );

        expect(jwtFinding).toBeDefined();
        expect(jwtFinding?.severity).toBe("critical");
      });

      it("should detect insecure default for SESSION_SECRET", async () => {
        const findings = await scanInsecureDefaults(vulnerableContext);

        const sessionFinding = findings.find(
          (f) => f.ruleId === "VC-CONFIG-002" && f.title.includes("SESSION_SECRET")
        );

        expect(sessionFinding).toBeDefined();
        expect(sessionFinding?.severity).toBe("critical");
      });
    });
  });

  describe("Hallucinations Pack", () => {
    describe("findSecurityImports", () => {
      it("should find default imports", () => {
        const content = `import helmet from "helmet";`;
        const imports = findSecurityImports(content, ["helmet"]);

        expect(imports).toHaveLength(1);
        expect(imports[0].library).toBe("helmet");
        expect(imports[0].importedNames).toEqual(["helmet"]);
        expect(imports[0].isDefaultImport).toBe(true);
      });

      it("should find named imports", () => {
        const content = `import { z, ZodError } from "zod";`;
        const imports = findSecurityImports(content, ["zod"]);

        expect(imports).toHaveLength(1);
        expect(imports[0].library).toBe("zod");
        expect(imports[0].importedNames).toContain("z");
        expect(imports[0].importedNames).toContain("ZodError");
      });

      it("should find namespace imports", () => {
        const content = `import * as yup from "yup";`;
        const imports = findSecurityImports(content, ["yup"]);

        expect(imports).toHaveLength(1);
        expect(imports[0].library).toBe("yup");
        expect(imports[0].isNamespaceImport).toBe(true);
      });
    });

    describe("checkIdentifierUsage", () => {
      it("should detect used identifiers", () => {
        const content = `import helmet from "helmet";

app.use(helmet());`;
        const usage = checkIdentifierUsage(content, 1, ["helmet"], false);

        expect(usage[0].used).toBe(true);
      });

      it("should detect unused identifiers", () => {
        const content = `import helmet from "helmet";

app.use(cors());`;
        const usage = checkIdentifierUsage(content, 1, ["helmet"], false);

        expect(usage[0].used).toBe(false);
      });

      it("should detect namespace usage", () => {
        const content = `import * as yup from "yup";

const schema = yup.object();`;
        const usage = checkIdentifierUsage(content, 1, ["yup"], true);

        expect(usage[0].used).toBe(true);
      });
    });
  });
});

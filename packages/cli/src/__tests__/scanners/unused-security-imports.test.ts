import { describe, it, expect } from "vitest";
import {
  findSecurityImports,
  checkIdentifierUsage,
  scanUnusedSecurityImports,
} from "../../scanners/unused-security-imports.js";
import type { ScanContext } from "../../scanners/types.js";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

describe("findSecurityImports", () => {
  it("finds default imports", () => {
    const content = `import zod from "zod";`;
    const imports = findSecurityImports(content, ["zod"]);
    expect(imports).toHaveLength(1);
    expect(imports[0].library).toBe("zod");
    expect(imports[0].importedNames).toContain("zod");
    expect(imports[0].isDefaultImport).toBe(true);
  });

  it("finds named imports", () => {
    const content = `import { z, ZodError } from "zod";`;
    const imports = findSecurityImports(content, ["zod"]);
    expect(imports).toHaveLength(1);
    expect(imports[0].importedNames).toContain("z");
    expect(imports[0].importedNames).toContain("ZodError");
  });

  it("finds namespace imports", () => {
    const content = `import * as yup from "yup";`;
    const imports = findSecurityImports(content, ["yup"]);
    expect(imports).toHaveLength(1);
    expect(imports[0].isNamespaceImport).toBe(true);
    expect(imports[0].importedNames).toContain("yup");
  });

  it("finds helmet import", () => {
    const content = `import helmet from "helmet";`;
    const imports = findSecurityImports(content, ["helmet"]);
    expect(imports).toHaveLength(1);
    expect(imports[0].library).toBe("helmet");
  });

  it("returns correct line numbers", () => {
    const content = `// line 1
// line 2
import { z } from "zod";
`;
    const imports = findSecurityImports(content, ["zod"]);
    expect(imports[0].line).toBe(3);
  });

  it("ignores non-security imports", () => {
    const content = `
import express from "express";
import { z } from "zod";
`;
    const imports = findSecurityImports(content, ["zod", "helmet"]);
    expect(imports).toHaveLength(1);
    expect(imports[0].library).toBe("zod");
  });
});

describe("checkIdentifierUsage", () => {
  it("detects used identifiers", () => {
    const content = `
import { z } from "zod";
const schema = z.string();
`;
    const result = checkIdentifierUsage(content, 2, ["z"], false);
    expect(result[0].used).toBe(true);
  });

  it("detects unused identifiers", () => {
    const content = `
import { z, ZodError } from "zod";
const schema = z.string();
`;
    const result = checkIdentifierUsage(content, 2, ["z", "ZodError"], false);
    expect(result.find((r) => r.identifier === "z")?.used).toBe(true);
    expect(result.find((r) => r.identifier === "ZodError")?.used).toBe(false);
  });

  it("handles namespace imports", () => {
    const content = `
import * as yup from "yup";
const schema = yup.string();
`;
    const result = checkIdentifierUsage(content, 2, ["yup"], true);
    expect(result[0].used).toBe(true);
  });

  it("detects unused namespace imports", () => {
    const content = `
import * as yup from "yup";
// not used
`;
    const result = checkIdentifierUsage(content, 2, ["yup"], true);
    expect(result[0].used).toBe(false);
  });
});

describe("scanUnusedSecurityImports", () => {
  it("finds unused zod import", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    fs.writeFileSync(
      path.join(tmpDir, "app.ts"),
      `import { z } from "zod";
// import is never used below
const x = 1;
`
    );

    try {
      const context: ScanContext = {
        targetDir: tmpDir,
        sourceFiles: ["app.ts"],
      };

      const findings = await scanUnusedSecurityImports(context);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe("VC-HALL-001");
      expect(findings[0].category).toBe("validation");
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("does not flag used imports", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    fs.writeFileSync(
      path.join(tmpDir, "app.ts"),
      `import { z } from "zod";
const schema = z.string();
`
    );

    try {
      const context: ScanContext = {
        targetDir: tmpDir,
        sourceFiles: ["app.ts"],
      };

      const findings = await scanUnusedSecurityImports(context);
      expect(findings).toHaveLength(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("finds unused helmet import", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    fs.writeFileSync(
      path.join(tmpDir, "server.ts"),
      `import helmet from "helmet";
// import is never used below
const app = express();
`
    );

    try {
      const context: ScanContext = {
        targetDir: tmpDir,
        sourceFiles: ["server.ts"],
      };

      const findings = await scanUnusedSecurityImports(context);
      expect(findings).toHaveLength(1);
      expect(findings[0].category).toBe("middleware");
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});

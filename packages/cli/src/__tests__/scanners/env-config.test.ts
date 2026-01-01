import { describe, it, expect } from "vitest";
import {
  parseEnvExample,
  findEnvUsages,
  scanEnvConfig,
} from "../../scanners/env-config.js";
import type { ScanContext } from "../../scanners/types.js";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

describe("parseEnvExample", () => {
  it("parses simple env file", () => {
    const content = `
DATABASE_URL=
API_KEY=your-key-here
SECRET_TOKEN=
`;
    const vars = parseEnvExample(content);
    expect(vars.has("DATABASE_URL")).toBe(true);
    expect(vars.has("API_KEY")).toBe(true);
    expect(vars.has("SECRET_TOKEN")).toBe(true);
  });

  it("ignores comments", () => {
    const content = `
# This is a comment
DATABASE_URL=
# API_KEY=should-be-ignored
`;
    const vars = parseEnvExample(content);
    expect(vars.has("DATABASE_URL")).toBe(true);
    expect(vars.has("API_KEY")).toBe(false);
  });

  it("handles empty lines", () => {
    const content = `

DATABASE_URL=

API_KEY=

`;
    const vars = parseEnvExample(content);
    expect(vars.size).toBe(2);
  });

  it("handles vars without values", () => {
    const content = `DATABASE_URL`;
    const vars = parseEnvExample(content);
    expect(vars.has("DATABASE_URL")).toBe(true);
  });
});

describe("findEnvUsages", () => {
  it("finds process.env.VAR usage", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const filePath = path.join(tmpDir, "test.ts");
    fs.writeFileSync(
      filePath,
      `
const url = process.env.DATABASE_URL;
const key = process.env.API_KEY;
`
    );

    try {
      const usages = findEnvUsages(["test.ts"], tmpDir);
      expect(usages).toHaveLength(2);
      expect(usages[0].name).toBe("DATABASE_URL");
      expect(usages[1].name).toBe("API_KEY");
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("finds bracket notation usage", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const filePath = path.join(tmpDir, "test.ts");
    fs.writeFileSync(
      filePath,
      `const url = process.env["DATABASE_URL"];`
    );

    try {
      const usages = findEnvUsages(["test.ts"], tmpDir);
      expect(usages).toHaveLength(1);
      expect(usages[0].name).toBe("DATABASE_URL");
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("returns correct line numbers", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const filePath = path.join(tmpDir, "test.ts");
    fs.writeFileSync(
      filePath,
      `// line 1
// line 2
const x = process.env.MY_VAR; // line 3
`
    );

    try {
      const usages = findEnvUsages(["test.ts"], tmpDir);
      expect(usages[0].line).toBe(3);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});

describe("scanEnvConfig", () => {
  it("creates findings for undocumented env vars", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const filePath = path.join(tmpDir, "app.ts");
    fs.writeFileSync(filePath, `const url = process.env.DATABASE_URL;`);

    try {
      const context: ScanContext = {
        targetDir: tmpDir,
        sourceFiles: ["app.ts"],
      };

      const findings = await scanEnvConfig(context);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe("VC-CONFIG-001");
      expect(findings[0].title).toContain("DATABASE_URL");
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("does not create findings for documented vars", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    fs.writeFileSync(
      path.join(tmpDir, "app.ts"),
      `const url = process.env.DATABASE_URL;`
    );
    fs.writeFileSync(path.join(tmpDir, ".env.example"), "DATABASE_URL=");

    try {
      const context: ScanContext = {
        targetDir: tmpDir,
        sourceFiles: ["app.ts"],
      };

      const findings = await scanEnvConfig(context);
      expect(findings).toHaveLength(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("marks SECRET-like vars as high severity", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    fs.writeFileSync(
      path.join(tmpDir, "app.ts"),
      `const key = process.env.API_SECRET_KEY;`
    );

    try {
      const context: ScanContext = {
        targetDir: tmpDir,
        sourceFiles: ["app.ts"],
      };

      const findings = await scanEnvConfig(context);
      expect(findings[0].severity).toBe("high");
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});

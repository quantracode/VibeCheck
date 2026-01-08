import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { loadRuleFile, loadRulesFromDirectory, validateCustomRules } from "../utils/custom-rules-loader.js";
import { createScannerFromRule } from "../scanners/custom-rule-engine.js";
import type { CustomRule, Finding } from "@vibecheck/schema";
import { buildScanContext } from "../scanners/helpers/index.js";

describe("Custom Rules", () => {
  const testDir = join(process.cwd(), "__test-custom-rules__");
  const rulesDir = join(testDir, "rules");
  const codeDir = join(testDir, "code");

  beforeEach(() => {
    mkdirSync(rulesDir, { recursive: true });
    mkdirSync(codeDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("Rule Loading", () => {
    it("should load a valid single rule from YAML", () => {
      const ruleYaml = `
id: TEST-RULE-001
severity: high
category: auth
title: "Test Rule"
description: "Test description"
match:
  contains: "test"
recommended_fix: "Fix it"
`;

      const rulePath = join(rulesDir, "test-rule.yaml");
      writeFileSync(rulePath, ruleYaml);

      const rules = loadRuleFile(rulePath);

      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe("TEST-RULE-001");
      expect(rules[0].severity).toBe("high");
      expect(rules[0].title).toBe("Test Rule");
    });

    it("should load multiple rules from a collection file", () => {
      const collectionYaml = `
schema_version: "1.0"
rules:
  - id: TEST-RULE-001
    severity: high
    category: auth
    title: "Rule 1"
    description: "Description 1"
    match:
      contains: "test1"
    recommended_fix: "Fix 1"
  - id: TEST-RULE-002
    severity: medium
    category: validation
    title: "Rule 2"
    description: "Description 2"
    match:
      contains: "test2"
    recommended_fix: "Fix 2"
`;

      const collectionPath = join(rulesDir, "collection.yaml");
      writeFileSync(collectionPath, collectionYaml);

      const rules = loadRuleFile(collectionPath);

      expect(rules).toHaveLength(2);
      expect(rules[0].id).toBe("TEST-RULE-001");
      expect(rules[1].id).toBe("TEST-RULE-002");
    });

    it("should skip disabled rules", () => {
      const ruleYaml = `
id: TEST-RULE-001
severity: high
category: auth
title: "Test Rule"
description: "Test description"
match:
  contains: "test"
recommended_fix: "Fix it"
enabled: false
`;

      const rulePath = join(rulesDir, "disabled-rule.yaml");
      writeFileSync(rulePath, ruleYaml);

      const rules = loadRuleFile(rulePath);

      expect(rules).toHaveLength(0);
    });

    it("should load all YAML files from a directory", () => {
      const rule1 = `
id: TEST-RULE-001
severity: high
category: auth
title: "Rule 1"
description: "Description 1"
match:
  contains: "test1"
recommended_fix: "Fix 1"
`;

      const rule2 = `
id: TEST-RULE-002
severity: medium
category: validation
title: "Rule 2"
description: "Description 2"
match:
  contains: "test2"
recommended_fix: "Fix 2"
`;

      writeFileSync(join(rulesDir, "rule1.yaml"), rule1);
      writeFileSync(join(rulesDir, "rule2.yml"), rule2);
      writeFileSync(join(rulesDir, "not-a-rule.txt"), "ignore me");

      const rules = loadRulesFromDirectory(rulesDir);

      expect(rules).toHaveLength(2);
      expect(rules.map((r) => r.id).sort()).toEqual(["TEST-RULE-001", "TEST-RULE-002"]);
    });

    it("should reject duplicate rule IDs", () => {
      const rule1 = `
id: TEST-RULE-001
severity: high
category: auth
title: "Rule 1"
description: "Description 1"
match:
  contains: "test"
recommended_fix: "Fix 1"
`;

      const rule2 = `
id: TEST-RULE-001
severity: medium
category: validation
title: "Rule 2 (duplicate ID)"
description: "Description 2"
match:
  contains: "test"
recommended_fix: "Fix 2"
`;

      writeFileSync(join(rulesDir, "rule1.yaml"), rule1);
      writeFileSync(join(rulesDir, "rule2.yaml"), rule2);

      const rules = loadRulesFromDirectory(rulesDir);

      // Should only load the first one
      expect(rules).toHaveLength(1);
      expect(rules[0].title).toBe("Rule 1");
    });
  });

  describe("Rule Validation", () => {
    it("should validate rules with at least one match condition", () => {
      const invalidRule: CustomRule = {
        id: "TEST-RULE-001",
        severity: "high",
        category: "auth",
        title: "Invalid Rule",
        description: "No match conditions",
        match: {}, // Empty match object
        recommended_fix: "Fix it",
        confidence: 0.8,
      };

      const { valid, errors } = validateCustomRules([invalidRule]);

      expect(valid).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0].error).toContain("at least one match condition");
    });

    it("should validate regex patterns", () => {
      const invalidRule: CustomRule = {
        id: "TEST-RULE-002",
        severity: "high",
        category: "auth",
        title: "Invalid Regex",
        description: "Bad regex",
        match: {
          regex: "[invalid(regex",
        },
        recommended_fix: "Fix it",
        confidence: 0.8,
      };

      const { valid, errors } = validateCustomRules([invalidRule]);

      expect(valid).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0].error).toContain("Invalid regex");
    });

    it("should accept valid rules", () => {
      const validRule: CustomRule = {
        id: "TEST-RULE-003",
        severity: "high",
        category: "auth",
        title: "Valid Rule",
        description: "This is valid",
        match: {
          contains: "test",
        },
        recommended_fix: "Fix it",
        confidence: 0.8,
      };

      const { valid, errors } = validateCustomRules([validRule]);

      expect(valid).toHaveLength(1);
      expect(errors).toHaveLength(0);
    });
  });

  describe("Rule Engine", () => {
    it("should match files based on contains condition", async () => {
      // Create a test file
      const testFile = join(codeDir, "test.ts");
      writeFileSync(testFile, "console.log('hello world');");

      // Create a rule to match console.log
      const rule: CustomRule = {
        id: "TEST-CONSOLE-001",
        severity: "low",
        category: "privacy",
        title: "Console.log found",
        description: "Remove console.log",
        match: {
          contains: "console.log",
        },
        recommended_fix: "Remove console.log",
        confidence: 0.7,
      };

      const scanner = createScannerFromRule(rule);
      const context = await buildScanContext(codeDir, {
        excludePatterns: [],
        includeTests: false,
      });

      const findings = await scanner(context);

      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe("TEST-CONSOLE-001");
      expect(findings[0].title).toBe("Console.log found");
    });

    it("should match files based on not_contains condition", async () => {
      // Create a test file WITHOUT auth
      const testFile = join(codeDir, "api", "route.ts");
      mkdirSync(join(codeDir, "api"), { recursive: true });
      writeFileSync(
        testFile,
        `export async function POST(request: Request) {
  const body = await request.json();
  return new Response('ok');
}`
      );

      // Rule: flag POST handlers without auth
      const rule: CustomRule = {
        id: "TEST-AUTH-001",
        severity: "high",
        category: "auth",
        title: "Missing authentication",
        description: "POST handler without auth",
        files: {
          file_type: ["ts"],
        },
        match: {
          contains: "export async function POST",
          not_contains: "getServerSession",
        },
        recommended_fix: "Add authentication",
        confidence: 0.8,
      };

      const scanner = createScannerFromRule(rule);
      const context = await buildScanContext(codeDir, {
        excludePatterns: [],
        includeTests: false,
      });

      const findings = await scanner(context);

      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe("TEST-AUTH-001");
    });

    it("should respect file type filters", async () => {
      // Create files of different types
      writeFileSync(join(codeDir, "test.ts"), "console.log('ts file');");
      writeFileSync(join(codeDir, "test.js"), "console.log('js file');");
      writeFileSync(join(codeDir, "test.txt"), "console.log('txt file');");

      // Rule: only match .ts files
      const rule: CustomRule = {
        id: "TEST-FILTER-001",
        severity: "low",
        category: "other",
        title: "Console.log in TS",
        description: "Console.log found",
        files: {
          file_type: ["ts"],
        },
        match: {
          contains: "console.log",
        },
        recommended_fix: "Remove it",
        confidence: 0.7,
      };

      const scanner = createScannerFromRule(rule);
      const context = await buildScanContext(codeDir, {
        excludePatterns: [],
        includeTests: false,
      });

      const findings = await scanner(context);

      expect(findings).toHaveLength(1);
      expect(findings[0].evidence[0].file).toContain("test.ts");
    });

    it("should match using regex patterns", async () => {
      const testFile = join(codeDir, "test.ts");
      writeFileSync(
        testFile,
        `const apiKey = "sk_live_1234567890abcdef";`
      );

      const rule: CustomRule = {
        id: "TEST-REGEX-001",
        severity: "critical",
        category: "secrets",
        title: "Hardcoded API key",
        description: "API key in source code",
        match: {
          regex: "sk_live_[a-zA-Z0-9]+",
        },
        recommended_fix: "Use environment variables",
        confidence: 0.95,
      };

      const scanner = createScannerFromRule(rule);
      const context = await buildScanContext(codeDir, {
        excludePatterns: [],
        includeTests: false,
      });

      const findings = await scanner(context);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe("critical");
    });
  });
});

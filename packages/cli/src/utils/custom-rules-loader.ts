import { readFileSync, statSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import { parse as parseYAML } from "yaml";
import {
  CustomRuleSchema,
  CustomRuleCollectionSchema,
  type CustomRule,
} from "@vibecheck/schema";

/**
 * Load a single YAML rule file
 */
export function loadRuleFile(filePath: string): CustomRule[] {
  try {
    const content = readFileSync(filePath, "utf-8");
    const parsed = parseYAML(content);

    // Try parsing as a collection first
    const collectionResult = CustomRuleCollectionSchema.safeParse(parsed);
    if (collectionResult.success) {
      return collectionResult.data.rules.filter((rule) => rule.enabled !== false);
    }

    // Try parsing as a single rule
    const ruleResult = CustomRuleSchema.safeParse(parsed);
    if (ruleResult.success) {
      return ruleResult.data.enabled !== false ? [ruleResult.data] : [];
    }

    throw new Error(
      `Invalid rule format in ${filePath}:\n${
        collectionResult.error?.message || ruleResult.error?.message
      }`
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load rule file ${filePath}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Load all YAML rule files from a directory
 */
export function loadRulesFromDirectory(dirPath: string): CustomRule[] {
  const rules: CustomRule[] = [];
  const seenIds = new Set<string>();

  try {
    const stat = statSync(dirPath);

    if (stat.isFile()) {
      // Single file provided
      const fileRules = loadRuleFile(dirPath);
      for (const rule of fileRules) {
        if (seenIds.has(rule.id)) {
          console.warn(
            `\x1b[33mWarning: Duplicate rule ID "${rule.id}" found, skipping duplicate\x1b[0m`
          );
          continue;
        }
        seenIds.add(rule.id);
        rules.push(rule);
      }
      return rules;
    }

    // Directory provided - load all YAML files
    const files = readdirSync(dirPath);

    for (const file of files) {
      const ext = extname(file).toLowerCase();
      if (![".yaml", ".yml"].includes(ext)) {
        continue;
      }

      const filePath = join(dirPath, file);
      try {
        const fileRules = loadRuleFile(filePath);

        for (const rule of fileRules) {
          if (seenIds.has(rule.id)) {
            console.warn(
              `\x1b[33mWarning: Duplicate rule ID "${rule.id}" in ${file}, skipping duplicate\x1b[0m`
            );
            continue;
          }
          seenIds.add(rule.id);
          rules.push(rule);
        }
      } catch (error) {
        console.error(
          `\x1b[31mError loading ${file}: ${
            error instanceof Error ? error.message : String(error)
          }\x1b[0m`
        );
        // Continue loading other files
      }
    }

    return rules;
  } catch (error) {
    throw new Error(
      `Failed to load rules from ${dirPath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Validate a set of custom rules
 */
export function validateCustomRules(rules: CustomRule[]): {
  valid: CustomRule[];
  errors: Array<{ ruleId: string; error: string }>;
} {
  const valid: CustomRule[] = [];
  const errors: Array<{ ruleId: string; error: string }> = [];

  for (const rule of rules) {
    try {
      // Validate that at least one match condition is provided
      if (
        !rule.match.contains &&
        !rule.match.not_contains &&
        !rule.match.regex
      ) {
        errors.push({
          ruleId: rule.id,
          error: "Rule must have at least one match condition (contains, not_contains, or regex)",
        });
        continue;
      }

      // Validate regex if provided
      if (rule.match.regex) {
        try {
          new RegExp(rule.match.regex);
        } catch (e) {
          errors.push({
            ruleId: rule.id,
            error: `Invalid regex pattern: ${rule.match.regex}`,
          });
          continue;
        }
      }

      // Validate file type filters
      if (rule.files?.file_type && rule.files.file_type.length === 0) {
        errors.push({
          ruleId: rule.id,
          error: "file_type array cannot be empty",
        });
        continue;
      }

      valid.push(rule);
    } catch (error) {
      errors.push({
        ruleId: rule.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { valid, errors };
}

/**
 * Print custom rules summary
 */
export function printRulesSummary(rules: CustomRule[]): void {
  if (rules.length === 0) {
    console.log("  No custom rules loaded");
    return;
  }

  console.log(`  Loaded ${rules.length} custom rule(s):`);

  // Group by category
  const byCategory = new Map<string, CustomRule[]>();
  for (const rule of rules) {
    const existing = byCategory.get(rule.category) || [];
    existing.push(rule);
    byCategory.set(rule.category, existing);
  }

  for (const [category, categoryRules] of byCategory) {
    console.log(`    \x1b[36m${category}\x1b[0m: ${categoryRules.length} rule(s)`);
    for (const rule of categoryRules) {
      const severityColor =
        rule.severity === "critical" || rule.severity === "high"
          ? "\x1b[31m"
          : rule.severity === "medium"
          ? "\x1b[33m"
          : "\x1b[36m";
      console.log(
        `      [${rule.id}] ${rule.title} (${severityColor}${rule.severity.toUpperCase()}\x1b[0m)`
      );
    }
  }
}

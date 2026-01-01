import type { Finding, Severity, EvidenceItem } from "@vibecheck/schema";
import { readFileSync, resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";
import type { ScanContext } from "../types.js";

const RULE_ID = "VC-CONFIG-001";

/**
 * Patterns that indicate a secret-like environment variable
 */
const SECRET_PATTERNS = /SECRET|KEY|TOKEN|PASSWORD|PRIVATE|CREDENTIAL|API_KEY|AUTH/i;

/**
 * Regex to find process.env.VARIABLE_NAME usage
 * Captures the variable name in group 1
 */
const PROCESS_ENV_REGEX = /process\.env\.([A-Z][A-Z0-9_]*)/g;

/**
 * Regex to find process.env["VARIABLE"] or process.env['VARIABLE'] usage
 */
const PROCESS_ENV_BRACKET_REGEX = /process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g;

interface EnvUsage {
  name: string;
  file: string;
  line: number;
  snippet: string;
}

/**
 * Parse .env.example file and extract defined variable names
 */
export function parseEnvExample(content: string): Set<string> {
  const vars = new Set<string>();
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (trimmed.startsWith("#") || trimmed === "") continue;

    // Match VAR_NAME= or VAR_NAME (without value)
    const match = trimmed.match(/^([A-Z][A-Z0-9_]*)(?:=|$)/);
    if (match) {
      vars.add(match[1]);
    }
  }

  return vars;
}

/**
 * Find all process.env usages in source files
 */
export function findEnvUsages(
  sourceFiles: string[],
  targetDir: string
): EnvUsage[] {
  const usages: EnvUsage[] = [];

  for (const relFile of sourceFiles) {
    const absPath = resolvePath(targetDir, relFile);
    const content = readFileSync(absPath);
    if (!content) continue;

    const lines = content.split("\n");

    // Find dot notation: process.env.VAR_NAME
    for (const match of content.matchAll(PROCESS_ENV_REGEX)) {
      const varName = match[1];
      const index = match.index!;

      // Find line number
      const beforeMatch = content.slice(0, index);
      const lineNumber = beforeMatch.split("\n").length;

      usages.push({
        name: varName,
        file: relFile,
        line: lineNumber,
        snippet: lines[lineNumber - 1]?.trim() ?? "",
      });
    }

    // Find bracket notation: process.env["VAR_NAME"]
    for (const match of content.matchAll(PROCESS_ENV_BRACKET_REGEX)) {
      const varName = match[1];
      const index = match.index!;

      const beforeMatch = content.slice(0, index);
      const lineNumber = beforeMatch.split("\n").length;

      usages.push({
        name: varName,
        file: relFile,
        line: lineNumber,
        snippet: lines[lineNumber - 1]?.trim() ?? "",
      });
    }
  }

  return usages;
}

/**
 * Determine severity based on variable name
 */
function getSeverity(varName: string): Severity {
  return SECRET_PATTERNS.test(varName) ? "high" : "medium";
}

/**
 * VC-CONFIG-001: Undocumented environment variable
 *
 * Finds process.env usage and checks if variables are documented in .env.example
 */
export async function scanUndocumentedEnv(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex } = context;
  const findings: Finding[] = [];

  // Check for .env.example
  const envExamplePath = resolvePath(repoRoot, ".env.example");
  const envExampleContent = readFileSync(envExamplePath);

  // Get documented env vars (empty set if no .env.example)
  const documentedVars = envExampleContent
    ? parseEnvExample(envExampleContent)
    : new Set<string>();

  // Find all env usages
  const usages = findEnvUsages(fileIndex.allSourceFiles, repoRoot);

  // Group usages by variable name
  const usagesByVar = new Map<string, EnvUsage[]>();
  for (const usage of usages) {
    const existing = usagesByVar.get(usage.name) ?? [];
    existing.push(usage);
    usagesByVar.set(usage.name, existing);
  }

  // Check each variable
  for (const [varName, varUsages] of usagesByVar) {
    if (documentedVars.has(varName)) {
      continue; // Variable is documented, no finding
    }

    const severity = getSeverity(varName);
    const firstUsage = varUsages[0];

    const evidence: EvidenceItem[] = varUsages.slice(0, 3).map((u) => ({
      file: u.file,
      startLine: u.line,
      endLine: u.line,
      snippet: u.snippet,
      label: `Usage of process.env.${varName}`,
    }));

    if (varUsages.length > 3) {
      evidence.push({
        file: varUsages[3].file,
        startLine: varUsages[3].line,
        endLine: varUsages[3].line,
        label: `...and ${varUsages.length - 3} more usages`,
      });
    }

    const fingerprint = generateFingerprint({
      ruleId: RULE_ID,
      file: firstUsage.file,
      symbol: varName,
    });

    const hasEnvExample = envExampleContent !== null;

    findings.push({
      id: generateFindingId({
        ruleId: RULE_ID,
        file: firstUsage.file,
        symbol: varName,
      }),
      severity,
      confidence: 0.85,
      category: "config",
      ruleId: RULE_ID,
      title: `Undocumented environment variable: ${varName}`,
      description: hasEnvExample
        ? `The environment variable "${varName}" is used in the codebase but is not listed in .env.example. This can lead to deployment issues or confusion for other developers.`
        : `The environment variable "${varName}" is used but no .env.example file exists. Consider creating one to document required configuration.`,
      evidence,
      remediation: {
        recommendedFix: hasEnvExample
          ? `Add "${varName}=" to .env.example with an appropriate default or placeholder value.`
          : `Create a .env.example file and add "${varName}=" with documentation.`,
      },
      fingerprint,
    });
  }

  return findings;
}

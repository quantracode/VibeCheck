import type { Finding, EvidenceItem, Severity } from "@vibecheck/schema";
import type { ScanContext } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";

const RULE_ID = "VC-CONFIG-002";

/**
 * VC-CONFIG-002: Insecure default secret fallback
 *
 * Detects patterns:
 * - process.env.* ?? "dev"
 * - process.env.* || "dev"
 * - Hardcoded secret strings assigned to SECRET/TOKEN/KEY/PASSWORD vars
 */
export async function scanInsecureDefaults(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex, helpers } = context;
  const findings: Finding[] = [];

  // Scan all source files
  for (const relPath of fileIndex.allSourceFiles) {
    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);

    if (!sourceFile) continue;

    const insecureDefaults = helpers.findInsecureDefaults(sourceFile);

    for (const def of insecureDefaults) {
      const severity: Severity = def.isCritical ? "critical" : "medium";

      const evidence: EvidenceItem[] = [
        {
          file: relPath,
          startLine: def.line,
          endLine: def.line,
          snippet: def.snippet,
          label: def.isCritical
            ? `Critical secret with hardcoded fallback: ${def.envVar}`
            : `Environment variable with hardcoded fallback: ${def.envVar}`,
        },
      ];

      const fingerprint = generateFingerprint({
        ruleId: RULE_ID,
        file: relPath,
        symbol: def.envVar,
        startLine: def.line,
      });

      findings.push({
        id: generateFindingId({
          ruleId: RULE_ID,
          file: relPath,
          symbol: def.envVar,
          startLine: def.line,
        }),
        ruleId: RULE_ID,
        title: `Insecure default for ${def.envVar}`,
        description: def.isCritical
          ? `The secret ${def.envVar} has a hardcoded fallback value "${def.fallbackValue.slice(0, 20)}${def.fallbackValue.length > 20 ? "..." : ""}". This is a critical security issue as the fallback value may be used in production if the environment variable is not set, potentially exposing a weak or predictable secret.`
          : `The environment variable ${def.envVar} has a hardcoded fallback value. While this may be intended for development, it could lead to insecure defaults being used in production.`,
        severity,
        confidence: def.isCritical ? 0.95 : 0.8,
        category: "config",
        evidence,
        remediation: {
          recommendedFix: `Remove the hardcoded fallback and require the environment variable to be explicitly set. Add validation at startup to fail fast if required secrets are missing.`,
          patch: `// Instead of:
const secret = process.env.${def.envVar} || "hardcoded";

// Do:
const secret = process.env.${def.envVar};
if (!secret) {
  throw new Error("${def.envVar} environment variable is required");
}`,
        },
        links: {
          cwe: "https://cwe.mitre.org/data/definitions/798.html",
          owasp: "https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/",
        },
        fingerprint,
      });
    }
  }

  return findings;
}

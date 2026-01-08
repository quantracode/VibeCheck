import type { Finding, EvidenceItem } from "@vibecheck/schema";
import type { ScanContext } from "../types.js";
import { resolvePath, readFileSync } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";

const RULE_ID = "VC-PRIV-003";

/**
 * VC-PRIV-003: Debug flags enabled in production-ish config
 *
 * Detect:
 * - next.config.* or server config with `dev: true`, `debug: true`, or logging level "debug"
 *
 * Precision:
 * - Only if NODE_ENV is checked or project appears production-ready
 */
export async function scanDebugFlags(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex } = context;
  const findings: Finding[] = [];

  // Check if project appears production-ready
  const hasVercelConfig = fileIndex.configFiles.some((f) => f.includes("vercel.json"));
  const pkgPath = resolvePath(repoRoot, "package.json");
  const pkgContent = readFileSync(pkgPath);
  const hasBuildScript = pkgContent && /"build"\s*:/.test(pkgContent);
  const isProdReady = hasVercelConfig || hasBuildScript;

  if (!isProdReady) {
    return findings;
  }

  // Check config files for debug flags
  const configPatterns = [
    "next.config.js",
    "next.config.mjs",
    "next.config.ts",
    "server.config.js",
    "server.config.ts",
    "app.config.js",
    "app.config.ts",
  ];

  for (const configFile of configPatterns) {
    const relPath = fileIndex.configFiles.find((f) => f.endsWith(configFile));
    if (!relPath) continue;

    const absPath = resolvePath(repoRoot, relPath);
    const content = readFileSync(absPath);
    if (!content) continue;

    // Check for debug flags
    const debugPatterns = [
      { pattern: /\bdev\s*:\s*true\b/, flag: "dev: true" },
      { pattern: /\bdebug\s*:\s*true\b/, flag: "debug: true" },
      { pattern: /logLevel\s*:\s*['"]debug['"]/, flag: 'logLevel: "debug"' },
      { pattern: /LOG_LEVEL\s*=\s*['"]debug['"]/, flag: 'LOG_LEVEL="debug"' },
      { pattern: /reactStrictMode\s*:\s*false\b/, flag: "reactStrictMode: false" },
    ];

    for (const { pattern, flag } of debugPatterns) {
      const match = content.match(pattern);
      if (!match) continue;

      // Check if it's conditional on NODE_ENV (which is acceptable)
      const lineIndex = content.substring(0, match.index).split("\n").length;
      const lines = content.split("\n");
      const contextStart = Math.max(0, lineIndex - 5);
      const contextEnd = Math.min(lines.length, lineIndex + 3);
      const contextLines = lines.slice(contextStart, contextEnd).join("\n");

      // Skip if guarded by NODE_ENV check
      if (/process\.env\.NODE_ENV\s*[!=]==?\s*['"]development['"]/i.test(contextLines)) {
        continue;
      }

      const evidence: EvidenceItem[] = [
        {
          file: relPath,
          startLine: lineIndex,
          endLine: lineIndex,
          snippet: lines[lineIndex - 1]?.trim() ?? flag,
          label: `Debug flag: ${flag}`,
        },
      ];

      if (hasVercelConfig) {
        evidence.push({
          file: "vercel.json",
          startLine: 1,
          endLine: 1,
          snippet: "Project has Vercel deployment config",
          label: "Production deployment detected",
        });
      }

      const fingerprint = generateFingerprint({
        ruleId: RULE_ID,
        file: relPath,
        symbol: flag,
        startLine: lineIndex,
      });

      findings.push({
        id: generateFindingId({
          ruleId: RULE_ID,
          file: relPath,
          symbol: flag,
        }),
        ruleId: RULE_ID,
        title: `Debug flag "${flag}" may be enabled in production`,
        description: `The configuration file contains ${flag} which may be active in production. Debug modes often expose sensitive information, enable verbose error messages, or disable security features. This configuration is not guarded by a NODE_ENV check.`,
        severity: "medium",
        confidence: 0.75,
        category: "config",
        evidence,
        remediation: {
          recommendedFix: `Ensure debug flags are only enabled in development. Use environment variables or NODE_ENV checks. Example: ...(process.env.NODE_ENV === 'development' && { debug: true }) or debug: process.env.DEBUG === 'true'.`,
          // No patch for debug flag fixes - requires understanding config structure and which flags to guard
        },
        links: {
          cwe: "https://cwe.mitre.org/data/definitions/489.html",
          owasp: "https://owasp.org/Top10/A05_2021-Security_Misconfiguration/",
        },
        fingerprint,
      });
    }
  }

  return findings;
}

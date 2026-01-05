/**
 * VC-SUP-001: Postinstall scripts detection
 *
 * Detects packages with postinstall/preinstall scripts which can execute
 * arbitrary code during npm install. This is a common supply chain attack vector.
 */

import type { Finding } from "@vibecheck/schema";
import type { ScanContext } from "../types.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";
import { parsePackageJson } from "./lockfile-parser.js";
import { findSuspiciousPatterns } from "./security-critical-packages.js";

const RULE_ID = "VC-SUP-001";

/**
 * Install script types to check
 */
const INSTALL_SCRIPT_KEYS = [
  "preinstall",
  "install",
  "postinstall",
  "prepare",
] as const;

/**
 * Scan for postinstall scripts in package.json
 */
export async function scanPostinstallScripts(context: ScanContext): Promise<Finding[]> {
  const { repoRoot } = context;
  const findings: Finding[] = [];

  const pkg = parsePackageJson(repoRoot);
  if (!pkg || !pkg.scripts) {
    return findings;
  }

  for (const scriptKey of INSTALL_SCRIPT_KEYS) {
    const script = pkg.scripts[scriptKey];
    if (!script) continue;

    // Check for suspicious patterns in the script
    const suspicious = findSuspiciousPatterns(script);

    // Determine severity based on script content
    let severity: Finding["severity"] = "low";
    let description = `The package.json contains a \`${scriptKey}\` script that runs during \`npm install\`. `;

    if (suspicious.length > 0) {
      severity = "high";
      description += `The script contains suspicious patterns:\n`;
      for (const { reason } of suspicious) {
        description += `- ${reason}\n`;
      }
    } else if (script.includes("node") || script.includes("npx")) {
      severity = "medium";
      description += `The script executes Node.js code which could perform arbitrary operations.`;
    } else {
      description += `While often legitimate, install scripts can be exploited for supply chain attacks. Review the script content.`;
    }

    const fingerprint = generateFingerprint({
      ruleId: RULE_ID,
      file: "package.json",
      symbol: scriptKey,
    });

    findings.push({
      id: generateFindingId({
        ruleId: RULE_ID,
        file: "package.json",
        symbol: scriptKey,
      }),
      severity,
      confidence: suspicious.length > 0 ? 0.9 : 0.7,
      category: "supply-chain",
      ruleId: RULE_ID,
      title: `Install script detected: ${scriptKey}`,
      description,
      evidence: [
        {
          file: "package.json",
          startLine: 1,
          endLine: 1,
          snippet: `"${scriptKey}": "${script.length > 100 ? script.slice(0, 100) + "..." : script}"`,
          label: "Install script definition",
        },
      ],
      remediation: {
        recommendedFix:
          suspicious.length > 0
            ? `Review and remove suspicious patterns from the ${scriptKey} script. Consider whether this script is necessary.`
            : `Review the ${scriptKey} script to ensure it performs only necessary build operations. Consider using --ignore-scripts flag in CI environments.`,
      },
      links: {
        cwe: "https://cwe.mitre.org/data/definitions/829.html",
      },
      fingerprint,
    });
  }

  return findings;
}

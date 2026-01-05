/**
 * VC-SUP-003: Deprecated packages detection
 *
 * Detects known deprecated or vulnerable packages using a local
 * heuristic list. No network calls - fully deterministic.
 */

import type { Finding } from "@vibecheck/schema";
import type { ScanContext } from "../types.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";
import { parsePackageJson } from "./lockfile-parser.js";
import { isDeprecated } from "./deprecated-packages.js";

const RULE_ID = "VC-SUP-003";

/**
 * Scan for deprecated/vulnerable packages
 */
export async function scanDeprecatedPackages(context: ScanContext): Promise<Finding[]> {
  const { repoRoot } = context;
  const findings: Finding[] = [];

  const pkg = parsePackageJson(repoRoot);
  if (!pkg) {
    return findings;
  }

  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  for (const [name, version] of Object.entries(allDeps)) {
    const deprecation = isDeprecated(name);
    if (!deprecation) continue;

    const isDevDep = name in (pkg.devDependencies || {});

    // Adjust severity for dev dependencies
    let severity = deprecation.severity;
    if (isDevDep && severity !== "critical") {
      severity = severity === "high" ? "medium" : "low";
    }

    let description = `The package \`${name}\` (${version}) is deprecated or has known vulnerabilities. `;
    description += `Reason: ${deprecation.reason}. `;

    if (deprecation.advisory) {
      description += `Advisory: ${deprecation.advisory}. `;
    }

    if (deprecation.replacement) {
      description += `Consider replacing with: ${deprecation.replacement}.`;
    }

    const fingerprint = generateFingerprint({
      ruleId: RULE_ID,
      file: "package.json",
      symbol: name,
    });

    findings.push({
      id: generateFindingId({
        ruleId: RULE_ID,
        file: "package.json",
        symbol: name,
      }),
      severity,
      confidence: 0.95,
      category: "supply-chain",
      ruleId: RULE_ID,
      title: `Deprecated/vulnerable package: ${name}`,
      description,
      evidence: [
        {
          file: "package.json",
          startLine: 1,
          endLine: 1,
          snippet: `"${name}": "${version}"`,
          context: isDevDep ? "devDependencies" : "dependencies",
        },
      ],
      remediation: {
        recommendedFix: deprecation.replacement
          ? `Replace ${name} with ${deprecation.replacement}. Remove ${name} from your dependencies and install the replacement.`
          : `Remove or update ${name} to a secure version. Check npm for the latest secure version or alternative packages.`,
      },
      links: {
        cwe: "https://cwe.mitre.org/data/definitions/1104.html",
      },
      fingerprint,
    });
  }

  return findings;
}

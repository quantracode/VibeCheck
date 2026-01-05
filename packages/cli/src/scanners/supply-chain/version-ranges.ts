/**
 * VC-SUP-002: Version ranges on security-critical libraries
 *
 * Detects when security-critical dependencies (auth, crypto) use version
 * ranges instead of pinned versions. Version ranges increase supply chain
 * risk by allowing automatic updates that could introduce vulnerabilities.
 */

import type { Finding } from "@vibecheck/schema";
import type { ScanContext } from "../types.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";
import { parsePackageJson, isVersionRange, getVersionRangeType } from "./lockfile-parser.js";
import { isSecurityCritical } from "./security-critical-packages.js";

const RULE_ID = "VC-SUP-002";

/**
 * Scan for unpinned versions of security-critical packages
 */
export async function scanVersionRanges(context: ScanContext): Promise<Finding[]> {
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
    // Check if this is a security-critical package
    const criticalInfo = isSecurityCritical(name);
    if (!criticalInfo) continue;

    // Check if version is a range
    if (!isVersionRange(version)) continue;

    const rangeType = getVersionRangeType(version);
    const isDevDep = name in (pkg.devDependencies || {});

    // Severity based on category
    let severity: Finding["severity"] = "medium";
    if (criticalInfo.category === "auth" || criticalInfo.category === "crypto") {
      severity = "high";
    }
    // Lower severity for dev dependencies
    if (isDevDep) {
      severity = severity === "high" ? "medium" : "low";
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
      confidence: 0.85,
      category: "supply-chain",
      ruleId: RULE_ID,
      title: `Unpinned security-critical dependency: ${name}`,
      description:
        `The ${criticalInfo.category} package \`${name}\` uses a version range (\`${version}\`) instead of a pinned version. ` +
        `This is a ${rangeType}. ` +
        `Version ranges allow automatic updates that could introduce breaking changes or supply chain attacks. ` +
        `Security-critical packages should use exact versions with lockfile commitment.`,
      evidence: [
        {
          file: "package.json",
          startLine: 1,
          endLine: 1,
          snippet: `"${name}": "${version}"`,
          label: `${isDevDep ? "devDependencies" : "dependencies"} - ${criticalInfo.reason}`,
        },
      ],
      remediation: {
        recommendedFix:
          `Pin ${name} to an exact version (e.g., "1.2.3" instead of "${version}"). ` +
          `Ensure your lockfile (package-lock.json, yarn.lock, or pnpm-lock.yaml) is committed to version control. ` +
          `Use automated dependency update tools (Dependabot, Renovate) to receive controlled updates.`,
      },
      links: {
        cwe: "https://cwe.mitre.org/data/definitions/829.html",
      },
      fingerprint,
    });
  }

  return findings;
}

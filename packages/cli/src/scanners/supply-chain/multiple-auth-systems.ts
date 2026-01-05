/**
 * VC-SUP-004: Multiple auth systems detection
 *
 * Detects when a project uses multiple authentication libraries/systems.
 * This often indicates:
 * - Migration in progress with incomplete cleanup
 * - Confusion about which auth system is active
 * - Potential authentication bypasses
 */

import type { Finding } from "@vibecheck/schema";
import type { ScanContext } from "../types.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";
import { parsePackageJson } from "./lockfile-parser.js";
import { detectAuthLibraries, AUTH_LIBRARY_GROUPS, type AuthLibraryGroup } from "./security-critical-packages.js";

const RULE_ID = "VC-SUP-004";

/**
 * Get friendly name for auth library group
 */
function getGroupName(group: AuthLibraryGroup): string {
  const names: Record<AuthLibraryGroup, string> = {
    nextAuth: "NextAuth.js / Auth.js",
    clerk: "Clerk",
    supabase: "Supabase Auth",
    firebase: "Firebase Auth",
    auth0: "Auth0",
    okta: "Okta",
    passport: "Passport.js",
    lucia: "Lucia",
    jwt: "Custom JWT (jsonwebtoken/jose)",
    betterAuth: "Better Auth",
  };
  return names[group] || group;
}

/**
 * Get compatible auth system pairs (not flagged as multiple)
 */
function areCompatible(groups: AuthLibraryGroup[]): boolean {
  // JWT libraries are often used alongside auth frameworks
  // Don't flag if JWT is the only "second" system
  const nonJwt = groups.filter((g) => g !== "jwt");

  // If only one non-JWT system, JWT is likely an implementation detail
  if (nonJwt.length <= 1) return true;

  return false;
}

/**
 * Scan for multiple authentication systems
 */
export async function scanMultipleAuthSystems(context: ScanContext): Promise<Finding[]> {
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

  const detectedGroups = detectAuthLibraries(allDeps);

  // Need at least 2 auth systems to flag
  if (detectedGroups.length < 2) {
    return findings;
  }

  // Check if they're compatible
  if (areCompatible(detectedGroups)) {
    return findings;
  }

  // Get the actual packages for each group
  const groupPackages: Record<string, string[]> = {};
  for (const group of detectedGroups) {
    const packages = AUTH_LIBRARY_GROUPS[group].filter((pkg) => pkg in allDeps);
    if (packages.length > 0) {
      groupPackages[group] = packages;
    }
  }

  const groupNames = detectedGroups.map(getGroupName);

  let description =
    `Multiple authentication systems detected: ${groupNames.join(", ")}. ` +
    `Having multiple auth libraries can lead to:\n` +
    `- Confusion about which system is enforcing authentication\n` +
    `- Incomplete migration leaving some routes unprotected\n` +
    `- Conflicting session/token handling\n\n` +
    `Detected packages:\n`;

  for (const [group, packages] of Object.entries(groupPackages)) {
    description += `- ${getGroupName(group as AuthLibraryGroup)}: ${packages.join(", ")}\n`;
  }

  // Build evidence from all detected packages
  const evidenceItems = [];
  for (const [group, packages] of Object.entries(groupPackages)) {
    for (const pkgName of packages) {
      evidenceItems.push({
        file: "package.json",
        startLine: 1,
        endLine: 1,
        snippet: `"${pkgName}": "${allDeps[pkgName]}"`,
        label: `${getGroupName(group as AuthLibraryGroup)} authentication library`,
      });
    }
  }

  const fingerprint = generateFingerprint({
    ruleId: RULE_ID,
    file: "package.json",
    symbol: detectedGroups.sort().join(","),
  });

  findings.push({
    id: generateFindingId({
      ruleId: RULE_ID,
      file: "package.json",
      symbol: "multiple-auth",
    }),
    severity: "medium",
    confidence: 0.75,
    category: "supply-chain",
    ruleId: RULE_ID,
    title: `Multiple authentication systems detected`,
    description,
    evidence: evidenceItems.slice(0, 5), // Limit evidence items
    remediation: {
      recommendedFix:
        `Consolidate to a single authentication system. If migrating, ensure the old system is fully removed after migration. ` +
        `If both are intentionally used (e.g., different auth for different parts of the app), document this clearly and ensure no authentication gaps exist.`,
    },
    links: {
      cwe: "https://cwe.mitre.org/data/definitions/287.html",
    },
    fingerprint,
  });

  return findings;
}

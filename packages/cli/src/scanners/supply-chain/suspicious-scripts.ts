/**
 * VC-SUP-005: Suspicious install scripts in dependencies
 *
 * Detects dependencies with suspicious install scripts when lockfile
 * information is available. This catches supply chain attacks that
 * inject malicious code via postinstall scripts.
 */

import type { Finding } from "@vibecheck/schema";
import type { ScanContext } from "../types.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";
import { parseLockfile } from "./lockfile-parser.js";
import { findSuspiciousPatterns } from "./security-critical-packages.js";

const RULE_ID = "VC-SUP-005";

/**
 * Known safe packages with install scripts
 * These are well-known packages that legitimately need install scripts
 */
const KNOWN_SAFE_INSTALL_SCRIPTS = new Set([
  // Native addons that need compilation
  "bcrypt",
  "argon2",
  "sharp",
  "canvas",
  "node-sass",
  "sqlite3",
  "better-sqlite3",
  "node-gyp",
  "fsevents",
  "esbuild",
  "@swc/core",
  "turbo",
  // Prisma
  "prisma",
  "@prisma/client",
  "@prisma/engines",
  // Playwright/Puppeteer (browser downloads)
  "playwright",
  "playwright-core",
  "puppeteer",
  "puppeteer-core",
  // Electron
  "electron",
  "electron-builder",
  // Husky/lint-staged (git hooks)
  "husky",
  "lefthook",
  // Other build tools
  "node-pre-gyp",
  "@mapbox/node-pre-gyp",
  "prebuild-install",
]);

/**
 * Scan for suspicious install scripts in dependencies
 */
export async function scanSuspiciousScripts(context: ScanContext): Promise<Finding[]> {
  const { repoRoot } = context;
  const findings: Finding[] = [];

  const lockfile = parseLockfile(repoRoot);

  // Skip if no lockfile
  if (lockfile.type === "none") {
    return findings;
  }

  for (const [name, pkg] of lockfile.packages) {
    // Skip if no install scripts flag
    if (!pkg.hasInstallScripts) continue;

    // Skip known safe packages
    if (KNOWN_SAFE_INSTALL_SCRIPTS.has(name)) continue;

    // Skip if not a direct dependency (transitive deps are harder to control)
    const isDirect = lockfile.directDependencies.has(name);

    // Check for actual script content if available
    let suspicious: Array<{ pattern: string; reason: string }> = [];
    let scriptContent = "";

    if (pkg.scripts) {
      const scripts = [
        pkg.scripts.preinstall,
        pkg.scripts.install,
        pkg.scripts.postinstall,
        pkg.scripts.prepare,
      ].filter(Boolean);

      scriptContent = scripts.join("\n");
      suspicious = findSuspiciousPatterns(scriptContent);
    }

    // Determine severity
    let severity: Finding["severity"] = "low";
    let confidence = 0.6;

    if (suspicious.length > 0) {
      severity = "high";
      confidence = 0.9;
    } else if (isDirect) {
      severity = "medium";
      confidence = 0.7;
    }

    let description =
      `The dependency \`${name}@${pkg.version}\` has install scripts that run during \`npm install\`. `;

    if (suspicious.length > 0) {
      description += `Suspicious patterns detected:\n`;
      for (const { reason } of suspicious) {
        description += `- ${reason}\n`;
      }
    } else {
      description +=
        `While install scripts are sometimes legitimate, they are also a common supply chain attack vector. ` +
        `Review the package to ensure the install script is necessary and safe.`;
    }

    const fingerprint = generateFingerprint({
      ruleId: RULE_ID,
      file: lockfile.path || "lockfile",
      symbol: name,
    });

    findings.push({
      id: generateFindingId({
        ruleId: RULE_ID,
        file: lockfile.path || "lockfile",
        symbol: name,
      }),
      severity,
      confidence,
      category: "supply-chain",
      ruleId: RULE_ID,
      title: `Dependency with install scripts: ${name}`,
      description,
      evidence: [
        {
          file: lockfile.path || "lockfile",
          startLine: 1,
          endLine: 1,
          snippet: `${name}@${pkg.version} (hasInstallScripts: true)`,
          label: isDirect ? "Direct dependency" : "Transitive dependency",
        },
        ...(scriptContent
          ? [
              {
                file: `node_modules/${name}/package.json`,
                startLine: 1,
                endLine: 1,
                snippet:
                  scriptContent.length > 200
                    ? scriptContent.slice(0, 200) + "..."
                    : scriptContent,
                label: "Install script content",
              },
            ]
          : []),
      ],
      remediation: {
        recommendedFix:
          suspicious.length > 0
            ? `Immediately review ${name} for malicious behavior. Consider removing the package or using --ignore-scripts during install.`
            : `Review ${name}'s install scripts to ensure they are safe. Consider using \`npm install --ignore-scripts\` in CI and running scripts explicitly after audit.`,
      },
      links: {
        cwe: "https://cwe.mitre.org/data/definitions/829.html",
      },
      fingerprint,
    });
  }

  return findings;
}

import type { Finding, EvidenceItem } from "@vibecheck/schema";
import type { ScanContext } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";
import { generateReplacementPatch } from "../helpers/patch-generator.js";

const RULE_ID = "VC-CRYPTO-003";

/**
 * VC-CRYPTO-003: Weak hashing for passwords
 *
 * Detect:
 * - bcrypt usage with saltRounds < 10
 * - crypto.createHash('md5'|'sha1') used on password-like vars
 */
export async function scanWeakHashing(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex, helpers } = context;
  const findings: Finding[] = [];

  for (const relPath of fileIndex.allSourceFiles) {
    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);

    if (!sourceFile) continue;

    const weakHashUsages = helpers.findWeakHashUsage(sourceFile);

    for (const usage of weakHashUsages) {
      const evidence: EvidenceItem[] = [
        {
          file: relPath,
          startLine: usage.line,
          endLine: usage.line,
          snippet: usage.snippet,
          label: `Weak hash algorithm: ${usage.algorithm}`,
        },
      ];

      const fingerprint = generateFingerprint({
        ruleId: RULE_ID,
        file: relPath,
        symbol: usage.algorithm,
        startLine: usage.line,
      });

      // Determine title and description based on algorithm
      let title: string;
      let description: string;
      let recommendedFix: string;

      if (usage.algorithm.startsWith("bcrypt")) {
        title = "Bcrypt with insufficient salt rounds";
        description = `Bcrypt is configured with low salt rounds (${usage.algorithm}). The cost factor should be at least 10 (ideally 12+) to provide adequate protection against brute-force attacks. Lower values make password cracking significantly faster.`;
        recommendedFix = "Increase bcrypt salt rounds to at least 10 (12 recommended): await bcrypt.hash(password, 12)";
      } else if (usage.algorithm === "md5" || usage.algorithm === "sha1") {
        title = `Weak hash algorithm (${usage.algorithm.toUpperCase()}) ${usage.isPasswordContext ? "for password" : "detected"}`;
        description = `${usage.algorithm.toUpperCase()} is cryptographically broken and should not be used for security purposes${usage.isPasswordContext ? ", especially for passwords" : ""}. MD5 can be brute-forced or attacked with rainbow tables in seconds. SHA1 has known collision vulnerabilities.`;
        recommendedFix = usage.isPasswordContext
          ? "For passwords, use bcrypt: await bcrypt.hash(password, 12)"
          : "For non-password hashing, use SHA-256: createHash('sha256').update(data).digest('hex')";
      } else {
        title = `Weak cryptographic configuration: ${usage.algorithm}`;
        description = `The cryptographic configuration "${usage.algorithm}" is considered weak and should be updated to current standards.`;
        recommendedFix = "Use modern, secure algorithms and configurations";
      }

      findings.push({
        id: generateFindingId({
          ruleId: RULE_ID,
          file: relPath,
          symbol: usage.algorithm,
          startLine: usage.line,
        }),
        ruleId: RULE_ID,
        title,
        description,
        severity: usage.isPasswordContext ? "high" : "medium",
        confidence: usage.isPasswordContext ? 0.9 : 0.75,
        category: "crypto",
        evidence,
        remediation: {
          recommendedFix,
          // No patch for crypto changes - too context-dependent
        },
        links: {
          cwe: "https://cwe.mitre.org/data/definitions/328.html",
          owasp: "https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html",
        },
        fingerprint,
      });
    }
  }

  return findings;
}

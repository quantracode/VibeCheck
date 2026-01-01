import type { Finding, EvidenceItem } from "@vibecheck/schema";
import type { ScanContext } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";

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
      let patch: string;

      if (usage.algorithm.startsWith("bcrypt")) {
        title = "Bcrypt with insufficient salt rounds";
        description = `Bcrypt is configured with low salt rounds (${usage.algorithm}). The cost factor should be at least 10 (ideally 12+) to provide adequate protection against brute-force attacks. Lower values make password cracking significantly faster.`;
        patch = `import bcrypt from 'bcrypt';

// Use at least 10 salt rounds (12 recommended):
const SALT_ROUNDS = 12;

const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);`;
      } else if (usage.algorithm === "md5" || usage.algorithm === "sha1") {
        title = `Weak hash algorithm (${usage.algorithm.toUpperCase()}) ${usage.isPasswordContext ? "for password" : "detected"}`;
        description = `${usage.algorithm.toUpperCase()} is cryptographically broken and should not be used for security purposes${usage.isPasswordContext ? ", especially for passwords" : ""}. MD5 can be brute-forced or attacked with rainbow tables in seconds. SHA1 has known collision vulnerabilities.`;
        patch = `// For passwords, use bcrypt or argon2:
import bcrypt from 'bcrypt';
const hashedPassword = await bcrypt.hash(password, 12);

// For non-password hashing (integrity checks, etc.):
import { createHash } from 'crypto';
const hash = createHash('sha256').update(data).digest('hex');`;
      } else {
        title = `Weak cryptographic configuration: ${usage.algorithm}`;
        description = `The cryptographic configuration "${usage.algorithm}" is considered weak and should be updated to current standards.`;
        patch = `// Use modern, secure algorithms and configurations`;
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
          recommendedFix: usage.isPasswordContext
            ? "Use bcrypt with at least 10 salt rounds, or argon2id for new applications."
            : "Use SHA-256 or stronger for integrity checks. For passwords, use bcrypt or argon2.",
          patch,
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

import type { Finding, EvidenceItem } from "@vibecheck/schema";
import type { ScanContext } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";

const RULE_ID = "VC-CRYPTO-001";

/**
 * VC-CRYPTO-001: Math.random used for tokens/secrets
 *
 * Detects Math.random used to generate:
 * - tokens, api keys, reset codes, session ids
 *
 * Two-signal:
 * - Math.random present AND variable/function name includes sensitive keywords
 */
export async function scanMathRandomTokens(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex, helpers } = context;
  const findings: Finding[] = [];

  for (const relPath of fileIndex.allSourceFiles) {
    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);

    if (!sourceFile) continue;

    const mathRandomUsages = helpers.findMathRandomUsage(sourceFile);

    for (const usage of mathRandomUsages) {
      if (!usage.isSensitiveContext) continue;

      const evidence: EvidenceItem[] = [
        {
          file: relPath,
          startLine: usage.line,
          endLine: usage.line,
          snippet: usage.snippet,
          label: `Math.random used for "${usage.variableName}"`,
        },
      ];

      const fingerprint = generateFingerprint({
        ruleId: RULE_ID,
        file: relPath,
        symbol: usage.variableName,
        startLine: usage.line,
      });

      findings.push({
        id: generateFindingId({
          ruleId: RULE_ID,
          file: relPath,
          symbol: usage.variableName,
          startLine: usage.line,
        }),
        ruleId: RULE_ID,
        title: `Insecure random for ${usage.variableName}`,
        description: `Math.random() is used to generate "${usage.variableName}" which appears to be a security-sensitive value. Math.random() is not cryptographically secure - its output can be predicted if an attacker knows the internal state. This makes tokens, session IDs, or reset codes guessable.`,
        severity: "high",
        confidence: 0.85,
        category: "crypto",
        evidence,
        remediation: {
          recommendedFix: `Use crypto.randomBytes() or crypto.randomUUID() for security-sensitive random values.`,
          patch: `import { randomBytes, randomUUID } from 'crypto';

// For tokens/keys (hex string):
const token = randomBytes(32).toString('hex');

// For session IDs (URL-safe base64):
const sessionId = randomBytes(24).toString('base64url');

// For UUIDs:
const id = randomUUID();

// For numbers in a range (e.g., 6-digit code):
const code = randomBytes(4).readUInt32BE() % 1000000;
const resetCode = code.toString().padStart(6, '0');`,
        },
        links: {
          cwe: "https://cwe.mitre.org/data/definitions/338.html",
          owasp: "https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html",
        },
        fingerprint,
      });
    }
  }

  return findings;
}

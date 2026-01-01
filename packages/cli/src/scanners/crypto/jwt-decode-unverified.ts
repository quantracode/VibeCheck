import type { Finding, EvidenceItem } from "@vibecheck/schema";
import type { ScanContext } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";

const RULE_ID = "VC-CRYPTO-002";

/**
 * VC-CRYPTO-002: JWT decoded but not verified
 *
 * Detects:
 * - jwt.decode(...) usage (jsonwebtoken)
 * - OR custom decode without verify call
 *
 * Precision:
 * - If jsonwebtoken is used, flag when decode is used AND no jwt.verify in same file
 */
export async function scanJwtDecodeUnverified(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex, helpers } = context;
  const findings: Finding[] = [];

  for (const relPath of fileIndex.allSourceFiles) {
    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);

    if (!sourceFile) continue;

    const jwtDecodes = helpers.findJwtDecodeWithoutVerify(sourceFile);

    for (const decode of jwtDecodes) {
      // Only flag if no verify in the same file
      if (decode.hasVerifyInFile) continue;

      const evidence: EvidenceItem[] = [
        {
          file: relPath,
          startLine: decode.line,
          endLine: decode.line,
          snippet: decode.snippet,
          label: "jwt.decode() used without jwt.verify()",
        },
      ];

      const fingerprint = generateFingerprint({
        ruleId: RULE_ID,
        file: relPath,
        symbol: "jwt.decode",
        startLine: decode.line,
      });

      findings.push({
        id: generateFindingId({
          ruleId: RULE_ID,
          file: relPath,
          symbol: "jwt.decode",
          startLine: decode.line,
        }),
        ruleId: RULE_ID,
        title: "JWT decoded without signature verification",
        description: `jwt.decode() is used without a corresponding jwt.verify() call in this file. The decode function only parses the JWT payload without verifying the signature, meaning an attacker could forge tokens with arbitrary claims. Always verify JWT signatures before trusting the payload.`,
        severity: "critical",
        confidence: 0.9,
        category: "crypto",
        evidence,
        remediation: {
          recommendedFix: `Use jwt.verify() instead of jwt.decode() to ensure the token signature is valid.`,
          patch: `import jwt from 'jsonwebtoken';

// WRONG - doesn't verify signature:
// const payload = jwt.decode(token);

// CORRECT - verifies signature:
try {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  // Token is valid, payload can be trusted
} catch (error) {
  // Token is invalid or expired
  throw new Error('Invalid token');
}

// If you need to read claims before verification (e.g., to get kid for key lookup):
const header = jwt.decode(token, { complete: true })?.header;
const kid = header?.kid;
// ... look up the correct key ...
const payload = jwt.verify(token, key); // MUST verify before trusting`,
        },
        links: {
          cwe: "https://cwe.mitre.org/data/definitions/347.html",
          owasp: "https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html",
        },
        fingerprint,
      });
    }
  }

  return findings;
}

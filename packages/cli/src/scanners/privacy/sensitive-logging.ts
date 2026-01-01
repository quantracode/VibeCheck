import type { Finding, EvidenceItem } from "@vibecheck/schema";
import type { ScanContext } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";

const RULE_ID = "VC-PRIV-001";

/**
 * VC-PRIV-001: Sensitive data logged
 *
 * Detects console.log/info/error or logger calls that include:
 * - tokens, authorization headers, passwords, secrets
 * - Variables named: password, token, auth, authorization, cookie, session, secret, apiKey
 */
export async function scanSensitiveLogging(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex, helpers } = context;
  const findings: Finding[] = [];

  // Scan all source files
  for (const relPath of fileIndex.allSourceFiles) {
    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);

    if (!sourceFile) continue;

    // Find all functions in the file
    const functions = sourceFile.getFunctions();
    const arrowFunctions = sourceFile.getDescendantsOfKind(
      // @ts-expect-error - ts-morph types
      sourceFile.getProject().getTypeChecker().compilerObject.SyntaxKind?.ArrowFunction ?? 213
    );

    // Check module-level code as well
    const sensitiveLogCalls = helpers.findSensitiveLogCalls({
      // Create a pseudo-function node that covers the whole file
      getDescendantsOfKind: (kind: number) => sourceFile.getDescendantsOfKind(kind),
      getText: () => sourceFile.getText(),
    } as any);

    for (const logCall of sensitiveLogCalls) {
      const evidence: EvidenceItem[] = [
        {
          file: relPath,
          startLine: logCall.line,
          endLine: logCall.line,
          snippet: logCall.snippet,
          label: `Sensitive data logged: ${logCall.sensitiveVars.join(", ")}`,
        },
      ];

      const fingerprint = generateFingerprint({
        ruleId: RULE_ID,
        file: relPath,
        symbol: logCall.sensitiveVars[0],
        startLine: logCall.line,
      });

      findings.push({
        id: generateFindingId({
          ruleId: RULE_ID,
          file: relPath,
          symbol: logCall.sensitiveVars[0],
          startLine: logCall.line,
        }),
        ruleId: RULE_ID,
        title: `Sensitive data in logs: ${logCall.sensitiveVars.join(", ")}`,
        description: `The ${logCall.logMethod} call includes sensitive data (${logCall.sensitiveVars.join(", ")}). This could expose credentials, tokens, or other sensitive information in log files, monitoring systems, or console output.`,
        severity: logCall.severity,
        confidence: 0.88,
        category: "privacy",
        evidence,
        remediation: {
          recommendedFix: `Remove sensitive data from log statements. Only log non-sensitive identifiers like user IDs, timestamps, or action types.`,
          patch: `// Instead of:
console.log("Login:", { email, password });

// Do:
console.log("Login attempt:", { email, timestamp: Date.now() });`,
        },
        links: {
          cwe: "https://cwe.mitre.org/data/definitions/532.html",
          owasp: "https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/",
        },
        fingerprint,
      });
    }
  }

  return findings;
}

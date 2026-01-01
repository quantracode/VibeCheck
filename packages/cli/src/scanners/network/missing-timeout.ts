import type { Finding, EvidenceItem } from "@vibecheck/schema";
import type { ScanContext } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";

const RULE_ID = "VC-NET-004";

/**
 * VC-NET-004: Missing request timeout on outbound calls
 *
 * Detects axios/fetch usage without explicit timeout:
 * - axios(...) without timeout option
 * - fetch(...) without AbortController / timeout wrapper
 *
 * Precision rule:
 * - Only flag when outbound call is inside a route handler (app/api/**) AND
 * - Call appears to hit non-localhost URL (string literal starting http)
 */
export async function scanMissingTimeout(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex, helpers } = context;
  const findings: Finding[] = [];

  // Only scan API route files
  for (const relPath of fileIndex.apiRouteFiles) {
    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);

    if (!sourceFile) continue;

    const handlers = helpers.findRouteHandlers(sourceFile);

    for (const handler of handlers) {
      const outboundCalls = helpers.findOutboundCalls(handler.functionNode);

      for (const call of outboundCalls) {
        // Only flag external URLs without timeout
        if (!call.isExternalUrl || call.hasTimeout) continue;

        const evidence: EvidenceItem[] = [
          {
            file: relPath,
            startLine: call.line,
            endLine: call.line,
            snippet: call.snippet,
            label: `${call.method} call to external URL without timeout`,
          },
        ];

        const fingerprint = generateFingerprint({
          ruleId: RULE_ID,
          file: relPath,
          symbol: call.method,
          startLine: call.line,
        });

        findings.push({
          id: generateFindingId({
            ruleId: RULE_ID,
            file: relPath,
            symbol: call.method,
            startLine: call.line,
          }),
          ruleId: RULE_ID,
          title: `Missing timeout on ${call.method} call`,
          description: `The outbound ${call.method} call to an external URL lacks a timeout configuration. If the external service is slow or unresponsive, this could cause your API handler to hang indefinitely, consuming server resources and potentially causing denial of service.`,
          severity: "low",
          confidence: 0.75,
          category: "network",
          evidence,
          remediation: {
            recommendedFix: `Add a timeout to prevent indefinite hangs. For fetch, use AbortController; for axios, use the timeout option.`,
            patch: `// For fetch, use AbortController:
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

try {
  const response = await fetch(url, {
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  return response;
} catch (error) {
  if (error.name === 'AbortError') {
    throw new Error('Request timed out');
  }
  throw error;
}

// For axios:
const response = await axios.get(url, {
  timeout: 5000,
});`,
          },
          links: {
            cwe: "https://cwe.mitre.org/data/definitions/400.html",
          },
          fingerprint,
        });
      }
    }
  }

  return findings;
}

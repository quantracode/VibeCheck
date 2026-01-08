import type { Finding, EvidenceItem } from "@vibecheck/schema";
import type { ScanContext } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";

const RULE_ID = "VC-NET-001";

/**
 * VC-NET-001: SSRF-prone fetch
 *
 * Detects fetch/axios calls using direct user-controlled input:
 * - fetch(body.url) / fetch(query.url) / axios.get(body.url)
 *
 * Only flags if the argument is a property named url/uri/link coming from req.json()/req.query
 */
export async function scanSsrfProneFetch(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex, helpers } = context;
  const findings: Finding[] = [];

  // Scan API route files (most likely to have SSRF issues)
  for (const relPath of fileIndex.apiRouteFiles) {
    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);

    if (!sourceFile) continue;

    const handlers = helpers.findRouteHandlers(sourceFile);

    for (const handler of handlers) {
      const ssrfCalls = helpers.findSsrfProneFetch(handler.functionNode);

      for (const ssrf of ssrfCalls) {
        const evidence: EvidenceItem[] = [
          {
            file: relPath,
            startLine: ssrf.line,
            endLine: ssrf.line,
            snippet: ssrf.snippet,
            label: `User-controlled URL passed to ${ssrf.fetchMethod}`,
          },
        ];

        const fingerprint = generateFingerprint({
          ruleId: RULE_ID,
          file: relPath,
          symbol: ssrf.fetchMethod,
          startLine: ssrf.line,
        });

        findings.push({
          id: generateFindingId({
            ruleId: RULE_ID,
            file: relPath,
            symbol: ssrf.fetchMethod,
            startLine: ssrf.line,
          }),
          ruleId: RULE_ID,
          title: `SSRF-prone ${ssrf.fetchMethod} call`,
          description: `The ${ssrf.fetchMethod} call uses user-controlled input (${ssrf.userInputSource}) as the URL. An attacker could manipulate this to make requests to internal services, cloud metadata endpoints, or other sensitive destinations.`,
          severity: "high",
          confidence: 0.85,
          category: "network",
          evidence,
          remediation: {
            recommendedFix: `Validate and sanitize the URL before use. Use an allowlist of permitted domains or URL patterns. Block requests to internal networks (10.x.x.x, 172.16-31.x.x, 192.168.x.x), localhost (127.x.x.x), and cloud metadata endpoints (169.254.169.254). Parse with new URL() and validate url.hostname.`,
            // No patch for SSRF validation - requires defining application-specific allowlist of permitted domains
          },
          links: {
            cwe: "https://cwe.mitre.org/data/definitions/918.html",
            owasp: "https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/",
          },
          fingerprint,
        });
      }
    }
  }

  return findings;
}

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
            recommendedFix: `Validate and sanitize the URL before use. Use an allowlist of permitted domains or URL patterns. Never allow requests to internal networks, localhost, or cloud metadata endpoints.`,
            patch: `// Validate URL before fetching
const url = new URL(userProvidedUrl);

// Check against allowlist
const allowedHosts = ["api.example.com", "cdn.example.com"];
if (!allowedHosts.includes(url.hostname)) {
  throw new Error("URL not allowed");
}

// Block internal addresses
const blockedPatterns = [
  /^localhost$/i,
  /^127\\.\\d+\\.\\d+\\.\\d+$/,
  /^10\\.\\d+\\.\\d+\\.\\d+$/,
  /^172\\.(1[6-9]|2[0-9]|3[0-1])\\.\\d+\\.\\d+$/,
  /^192\\.168\\.\\d+\\.\\d+$/,
  /^169\\.254\\.169\\.254$/, // AWS metadata
];
if (blockedPatterns.some(p => p.test(url.hostname))) {
  throw new Error("URL not allowed");
}

const response = await fetch(url.toString());`,
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

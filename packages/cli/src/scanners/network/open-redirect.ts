import type { Finding, EvidenceItem } from "@vibecheck/schema";
import type { ScanContext } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";

const RULE_ID = "VC-NET-002";

/**
 * VC-NET-002: Open Redirect
 *
 * Detects server-side redirects where user-controlled input determines destination:
 * - NextResponse.redirect(userValue)
 * - res.redirect(userValue)
 * - redirect(userValue) (next/navigation on server)
 *
 * Two-signal requirement:
 * - Must identify user-controlled source AND redirect call uses that value
 */
export async function scanOpenRedirect(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex, helpers } = context;
  const findings: Finding[] = [];

  // Scan API route files and server components
  const filesToScan = [...fileIndex.apiRouteFiles, ...fileIndex.routeFiles];

  for (const relPath of filesToScan) {
    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);

    if (!sourceFile) continue;

    const handlers = helpers.findRouteHandlers(sourceFile);

    for (const handler of handlers) {
      const redirectCalls = helpers.findRedirectCalls(handler.functionNode);

      for (const redirect of redirectCalls) {
        if (!redirect.isUserControlled) continue;

        const evidence: EvidenceItem[] = [
          {
            file: relPath,
            startLine: redirect.line,
            endLine: redirect.line,
            snippet: redirect.snippet,
            label: `User-controlled redirect via ${redirect.userControlledSource}`,
          },
        ];

        const fingerprint = generateFingerprint({
          ruleId: RULE_ID,
          file: relPath,
          symbol: redirect.method,
          startLine: redirect.line,
        });

        findings.push({
          id: generateFindingId({
            ruleId: RULE_ID,
            file: relPath,
            symbol: redirect.method,
            startLine: redirect.line,
          }),
          ruleId: RULE_ID,
          title: `Open redirect via ${redirect.method}`,
          description: `The ${redirect.method} call uses user-controlled input (${redirect.userControlledSource}) to determine the redirect destination. An attacker could craft a malicious link that redirects users to a phishing site or malicious domain, abusing the trust users place in your domain.`,
          severity: "high",
          confidence: 0.85,
          category: "network",
          evidence,
          remediation: {
            recommendedFix: `Validate the redirect URL against an allowlist of permitted paths or domains. Never redirect to arbitrary user-provided URLs without validation. Options: (1) Only allow relative paths: check !url.startsWith('/') || url.startsWith('//'), (2) Use allowlist: check allowedPaths.some(path => url.startsWith(path)).`,
            // No patch for redirect validation - requires defining application-specific allowlist of permitted paths/domains
          },
          links: {
            cwe: "https://cwe.mitre.org/data/definitions/601.html",
            owasp: "https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html",
          },
          fingerprint,
        });
      }
    }
  }

  return findings;
}

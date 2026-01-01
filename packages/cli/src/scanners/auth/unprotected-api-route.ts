import type { Finding, EvidenceItem, Severity } from "@vibecheck/schema";
import type { ScanContext, DbSink } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";

const RULE_ID = "VC-AUTH-001";

/**
 * Methods that modify state and require authentication
 */
const STATE_CHANGING_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

/**
 * Extract route path from file path
 * e.g., app/api/users/route.ts -> /api/users
 */
function extractRoutePath(filePath: string): string {
  // Normalize slashes
  const normalized = filePath.replace(/\\/g, "/");

  // Extract from app/api/... pattern
  const match = normalized.match(/(?:app|src\/app)(\/api\/[^/]+(?:\/[^/]+)*?)\/route\.[tj]sx?$/);
  if (match) {
    return match[1];
  }

  // Fallback: just return the file path
  return normalized;
}

/**
 * Determine severity based on sink type
 */
function getSeverity(sinks: DbSink[]): Severity {
  const hasCritical = sinks.some((s) => s.isCritical);
  return hasCritical ? "critical" : "high";
}

/**
 * VC-AUTH-001: Unprotected state-changing API route
 *
 * Identifies Next.js App Router route handlers that:
 * 1. Export POST/PUT/PATCH/DELETE methods
 * 2. Contain database write/delete operations or export functionality
 * 3. Do NOT contain any server-side auth checks
 */
export async function scanUnprotectedApiRoutes(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex, helpers, repoMeta } = context;
  const findings: Finding[] = [];

  // Only scan Next.js projects
  if (repoMeta.framework !== "next") {
    return findings;
  }

  // Scan API route files
  for (const relPath of fileIndex.apiRouteFiles) {
    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);

    if (!sourceFile) continue;

    const handlers = helpers.findRouteHandlers(sourceFile);

    for (const handler of handlers) {
      // Only check state-changing methods
      if (!STATE_CHANGING_METHODS.includes(handler.method)) {
        continue;
      }

      // Check for auth
      const hasAuth = helpers.containsAuthCheck(handler.functionNode);
      if (hasAuth) {
        continue;
      }

      // Find database sinks
      const sinks = helpers.findDbSinks(handler.functionNode);

      // Only flag if there are dangerous sinks
      if (sinks.length === 0) {
        continue;
      }

      const routePath = extractRoutePath(relPath);
      const severity = getSeverity(sinks);

      const evidence: EvidenceItem[] = [
        {
          file: relPath,
          startLine: handler.startLine,
          endLine: handler.endLine,
          snippet: helpers.getNodeText(handler.functionNode).slice(0, 200) + "...",
          label: `Unprotected ${handler.method} handler`,
        },
        ...sinks.slice(0, 2).map((sink) => ({
          file: relPath,
          startLine: sink.line,
          endLine: sink.line,
          snippet: sink.snippet,
          label: `${sink.kind} ${sink.operation} operation without auth check`,
        })),
      ];

      const fingerprint = generateFingerprint({
        ruleId: RULE_ID,
        file: relPath,
        symbol: handler.method,
        route: routePath,
      });

      const sinkOperations = sinks.map((s) => `${s.kind}.${s.operation}`).join(", ");

      findings.push({
        id: generateFindingId({
          ruleId: RULE_ID,
          file: relPath,
          symbol: handler.method,
        }),
        ruleId: RULE_ID,
        title: `Unprotected ${handler.method} route: ${routePath}`,
        description: `The API route ${routePath} exports a ${handler.method} handler that performs database operations (${sinkOperations}) without any authentication checks. An attacker could invoke this endpoint directly to modify or delete data without authorization.`,
        severity,
        confidence: 0.88,
        category: "auth",
        evidence,
        remediation: {
          recommendedFix: `Add authentication to the ${handler.method} handler. Check for a valid session using getServerSession(), auth(), or similar before performing database operations.`,
          patch: `// Add at the start of your handler:
const session = await getServerSession(authOptions);
if (!session) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" }
  });
}`,
        },
        links: {
          owasp: "https://owasp.org/Top10/A01_2021-Broken_Access_Control/",
          cwe: "https://cwe.mitre.org/data/definitions/306.html",
        },
        fingerprint,
      });
    }
  }

  return findings;
}

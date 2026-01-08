import type { Finding, EvidenceItem } from "@vibecheck/schema";
import type { ScanContext } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";

const RULE_ID = "VC-VAL-002";

/**
 * VC-VAL-002: Client-side-only validation
 *
 * Detects if validation libraries (zod/yup/joi) are used in frontend components
 * but API route handlers accept raw input without validation.
 *
 * Precision rule:
 * - Only flag if there exists at least one validation schema used in frontend
 * - AND at least one API route file exists that uses req.json without validation
 */
export async function scanClientSideOnlyValidation(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex, helpers } = context;
  const findings: Finding[] = [];

  // Find frontend files with validation
  const frontendFilesWithValidation: string[] = [];

  for (const relPath of fileIndex.allSourceFiles) {
    // Check if it's a frontend file (components, pages, but NOT api routes)
    const isFrontend = (relPath.includes("/components/") ||
      relPath.includes("\\components\\") ||
      relPath.includes("/app/") ||
      relPath.includes("\\app\\")) &&
      !relPath.includes("/api/") &&
      !relPath.includes("\\api\\") &&
      (relPath.endsWith(".tsx") || relPath.endsWith(".jsx"));

    if (!isFrontend) continue;

    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);
    if (!sourceFile) continue;

    if (helpers.hasValidationSchemas(sourceFile)) {
      frontendFilesWithValidation.push(relPath);
    }
  }

  // If no frontend validation found, skip
  if (frontendFilesWithValidation.length === 0) {
    return findings;
  }

  // Check API routes for missing server-side validation
  for (const relPath of fileIndex.apiRouteFiles) {
    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);
    if (!sourceFile) continue;

    const handlers = helpers.findRouteHandlers(sourceFile);
    const fileHasValidation = helpers.hasValidationSchemas(sourceFile);

    for (const handler of handlers) {
      // Only check POST/PUT/PATCH handlers that accept body
      if (!["POST", "PUT", "PATCH"].includes(handler.method)) continue;

      const handlerText = helpers.getNodeText(handler.functionNode);

      // Check if handler reads request body
      const readsBody = /\.json\s*\(\s*\)|\.body\b|await\s+request\.json\s*\(\s*\)/.test(handlerText);
      if (!readsBody) continue;

      // Check if handler has validation
      const validationUsages = helpers.findValidationUsage(handler.functionNode);
      const hasValidation = validationUsages.length > 0 || fileHasValidation;

      if (hasValidation) continue;

      const evidence: EvidenceItem[] = [
        {
          file: relPath,
          startLine: handler.startLine,
          endLine: handler.endLine,
          snippet: handlerText.slice(0, 200) + "...",
          label: `${handler.method} handler accepts request body without server-side validation`,
        },
        {
          file: frontendFilesWithValidation[0],
          startLine: 1,
          endLine: 1,
          snippet: `Validation schema found in frontend component`,
          label: "Frontend validation exists but server validation missing",
        },
      ];

      const fingerprint = generateFingerprint({
        ruleId: RULE_ID,
        file: relPath,
        symbol: handler.method,
        startLine: handler.startLine,
      });

      findings.push({
        id: generateFindingId({
          ruleId: RULE_ID,
          file: relPath,
          symbol: handler.method,
          startLine: handler.startLine,
        }),
        ruleId: RULE_ID,
        title: `Client-side-only validation on ${handler.method} endpoint`,
        description: `This API endpoint accepts request body data without server-side validation, while validation schemas exist in frontend components. Client-side validation can be easily bypassed - attackers can send requests directly to your API. Always validate input on the server.`,
        severity: "medium",
        confidence: 0.7,
        category: "validation",
        evidence,
        remediation: {
          recommendedFix: `Add server-side validation using the same schema. Consider sharing schemas between frontend and backend. Example with Zod: const result = schema.safeParse(body); if (!result.success) return Response.json({ error: result.error }, { status: 400 }); then use result.data for validated values.`,
          // No patch for validation addition - requires knowing the validation schema structure and which fields to validate
        },
        links: {
          cwe: "https://cwe.mitre.org/data/definitions/20.html",
          owasp: "https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html",
        },
        fingerprint,
      });
    }
  }

  return findings;
}

/**
 * VC-HALL-012: Validation Claimed But Missing/Ignored
 *
 * Detects routes where validation is claimed (via comments, imports,
 * or identifiers) but is either not implemented or the validated
 * result is not used.
 *
 * Severity: Medium
 * Category: hallucinations
 * Confidence: 0.80
 */

import crypto from "node:crypto";
import path from "node:path";
import type { Finding } from "@vibecheck/schema";
import type { ScanContext, RouteInfo, IntentClaim } from "../../scanners/types.js";
import { buildRouteMap, buildAllProofTraces } from "../proof-trace-builder.js";
import { mineAllIntentClaims } from "../intent-miner.js";

const RULE_ID = "VC-HALL-012";

export async function scanValidationClaimedMissing(
  ctx: ScanContext
): Promise<Finding[]> {
  const findings: Finding[] = [];

  // Build route map and proof traces
  const routes = buildRouteMap(ctx);
  const proofTraces = buildAllProofTraces(ctx, routes);
  const intentClaims = mineAllIntentClaims(ctx, routes);

  // Find validation claims
  const validationClaims = intentClaims.filter(
    (c) => c.type === "INPUT_VALIDATED"
  );

  // Group claims by file for efficiency
  const claimsByFile = new Map<string, IntentClaim[]>();
  for (const claim of validationClaims) {
    const existing = claimsByFile.get(claim.location.file) || [];
    existing.push(claim);
    claimsByFile.set(claim.location.file, existing);
  }

  // Check each file with validation claims
  for (const [file, claims] of claimsByFile) {
    const sourceFile = ctx.helpers.parseFile(path.join(ctx.repoRoot, file));
    if (!sourceFile) continue;

    // Find routes in this file
    const fileRoutes = routes.filter((r) => r.file === file);
    const handlers = ctx.helpers.findRouteHandlers(sourceFile);

    for (const handler of handlers) {
      const route = fileRoutes.find((r) => r.method === handler.method);
      if (!route) continue;

      // Check if this handler should have validation
      const relevantClaims = claims.filter(
        (c) =>
          c.targetRouteId === route.routeId ||
          c.scope === "module" ||
          c.scope === "global" ||
          (c.location.startLine <= handler.startLine &&
            c.location.endLine >= handler.startLine - 5) // Claim is near handler
      );

      if (relevantClaims.length === 0) continue;

      // Check actual validation status
      const validationUsage = ctx.helpers.findValidationUsage(handler.functionNode);

      // Case 1: No validation at all despite claims
      if (validationUsage.length === 0) {
        findings.push(createFinding(
          route,
          relevantClaims[0],
          "missing",
          "Validation is claimed but no validation library usage found in handler"
        ));
        continue;
      }

      // Case 2: Validation exists but result not assigned
      const unassigned = validationUsage.filter((v) => !v.resultAssigned);
      if (unassigned.length > 0) {
        findings.push(createFinding(
          route,
          relevantClaims[0],
          "ignored_result",
          "Validation is called but the result is not assigned to a variable",
          {
            file: route.file,
            line: unassigned[0].line,
            snippet: ctx.helpers.getNodeText(unassigned[0].node).slice(0, 100),
          }
        ));
        continue;
      }

      // Case 3: Validation result assigned but raw body still used
      const rawBodyUsed = validationUsage.filter((v) => v.rawBodyUsedAfter);
      if (rawBodyUsed.length > 0) {
        findings.push(createFinding(
          route,
          relevantClaims[0],
          "bypassed",
          "Validation is performed but raw request body is used afterward instead of validated data",
          {
            file: route.file,
            line: rawBodyUsed[0].line,
            snippet: ctx.helpers.getNodeText(rawBodyUsed[0].node).slice(0, 100),
          }
        ));
      }
    }
  }

  // Also check for validation imports that are never used
  findings.push(...checkUnusedValidationImports(ctx, routes, intentClaims));

  return findings;
}

function createFinding(
  route: RouteInfo,
  claim: IntentClaim,
  issueType: "missing" | "ignored_result" | "bypassed",
  description: string,
  additionalEvidence?: { file: string; line: number; snippet: string }
): Finding {
  const evidence = [
    {
      file: claim.location.file,
      startLine: claim.location.startLine,
      endLine: claim.location.endLine,
      snippet: claim.textEvidence,
      label: `Validation claim (${claim.source})`,
    },
    {
      file: route.file,
      startLine: route.startLine,
      endLine: route.endLine,
      snippet: `${route.method} ${route.path}`,
      label: "Route handler",
    },
  ];

  if (additionalEvidence) {
    evidence.push({
      file: additionalEvidence.file,
      startLine: additionalEvidence.line,
      endLine: additionalEvidence.line,
      snippet: additionalEvidence.snippet,
      label: issueType === "ignored_result" ? "Unused validation call" : "Raw body usage",
    });
  }

  return {
    id: `f-${crypto.randomUUID().slice(0, 8)}`,
    severity: "medium",
    confidence: 0.8,
    category: "hallucinations",
    ruleId: RULE_ID,
    title: generateTitle(route, issueType),
    description,
    evidence,
    remediation: {
      recommendedFix: generateRemediation(issueType),
    },
    fingerprint: generateFingerprint(route, issueType),
  };
}

function generateTitle(route: RouteInfo, issueType: string): string {
  switch (issueType) {
    case "missing":
      return `Validation claimed but missing in ${route.method} ${route.path}`;
    case "ignored_result":
      return `Validation result ignored in ${route.method} ${route.path}`;
    case "bypassed":
      return `Validation bypassed in ${route.method} ${route.path}`;
    default:
      return `Validation issue in ${route.method} ${route.path}`;
  }
}

function generateRemediation(issueType: string): string {
  switch (issueType) {
    case "missing":
      return (
        "Implement validation using Zod, Yup, or Joi. " +
        "Example: `const validated = schema.parse(await request.json());` " +
        "Then use `validated` instead of the raw request body."
      );
    case "ignored_result":
      return (
        "Assign the validation result to a variable and use it: " +
        "`const validated = schema.parse(body);` " +
        "Then pass `validated` to database operations."
      );
    case "bypassed":
      return (
        "Replace usage of raw `body`, `req.body`, or `request.json()` result " +
        "with the validated data. Using raw input after validation defeats its purpose."
      );
    default:
      return "Ensure validation is properly implemented and the validated result is used.";
  }
}

function checkUnusedValidationImports(
  ctx: ScanContext,
  routes: RouteInfo[],
  claims: IntentClaim[]
): Finding[] {
  const findings: Finding[] = [];

  // Find import-based validation claims
  const importClaims = claims.filter(
    (c) => c.type === "INPUT_VALIDATED" && c.source === "import"
  );

  for (const claim of importClaims) {
    const sourceFile = ctx.helpers.parseFile(
      path.join(ctx.repoRoot, claim.location.file)
    );
    if (!sourceFile) continue;

    // Check if validation schemas/methods are actually defined and used
    const hasSchemas = ctx.helpers.hasValidationSchemas(sourceFile);

    if (!hasSchemas) {
      // Validation library imported but no schemas defined
      const fileRoutes = routes.filter((r) => r.file === claim.location.file);

      if (fileRoutes.length > 0) {
        findings.push({
          id: `f-${crypto.randomUUID().slice(0, 8)}`,
          severity: "medium",
          confidence: 0.7,
          category: "hallucinations",
          ruleId: RULE_ID,
          title: `Validation library imported but no schemas defined in ${claim.location.file}`,
          description:
            "A validation library is imported suggesting validation intent, " +
            "but no validation schemas are defined in the file. " +
            "This could be dead code or incomplete implementation.",
          evidence: [
            {
              file: claim.location.file,
              startLine: claim.location.startLine,
              endLine: claim.location.endLine,
              snippet: claim.textEvidence,
              label: "Validation import",
            },
          ],
          remediation: {
            recommendedFix:
              "Define validation schemas using the imported library, or remove the unused import.",
          },
          fingerprint: `sha256:${crypto
            .createHash("sha256")
            .update(`${RULE_ID}:${claim.location.file}:import_unused`)
            .digest("hex")}`,
        });
      }
    }
  }

  return findings;
}

function generateFingerprint(route: RouteInfo, issueType: string): string {
  const data = `${RULE_ID}:${route.file}:${route.method}:${issueType}`;
  return `sha256:${crypto.createHash("sha256").update(data).digest("hex")}`;
}

/**
 * VC-HALL-010: Comment Claims Protection But Unproven
 *
 * Detects comments that claim security protection but the actual
 * implementation doesn't prove it.
 *
 * Severity: Medium
 * Category: hallucinations
 * Confidence: 0.75
 */

import crypto from "node:crypto";
import type { Finding } from "@vibecheck/schema";
import type { ScanContext, RouteInfo, ProofTrace, IntentClaim } from "../../scanners/types.js";
import { buildRouteMap, buildAllProofTraces } from "../proof-trace-builder.js";
import { mineAllIntentClaims, findUnprovenClaims } from "../intent-miner.js";

const RULE_ID = "VC-HALL-010";

export async function scanCommentClaimUnproven(
  ctx: ScanContext
): Promise<Finding[]> {
  const findings: Finding[] = [];

  // Build route map and proof traces
  const routes = buildRouteMap(ctx);
  const proofTraces = buildAllProofTraces(ctx, routes);

  // Mine intent claims from comments
  const allClaims = mineAllIntentClaims(ctx, routes);
  const commentClaims = allClaims.filter((c) => c.source === "comment");

  // Find claims that aren't proven
  const unprovenClaims = findUnprovenCommentClaims(commentClaims, proofTraces, routes);

  for (const claim of unprovenClaims) {
    const route = routes.find((r) => r.routeId === claim.targetRouteId);
    const trace = claim.targetRouteId ? proofTraces.get(claim.targetRouteId) : undefined;

    findings.push({
      id: generateFindingId(claim),
      severity: "medium",
      confidence: 0.75,
      category: "hallucinations",
      ruleId: RULE_ID,
      title: `Comment claims ${formatClaimType(claim.type)} but implementation doesn't prove it`,
      description: generateDescription(claim, route, trace),
      evidence: [
        {
          file: claim.location.file,
          startLine: claim.location.startLine,
          endLine: claim.location.endLine,
          snippet: claim.textEvidence,
          label: "Security claim in comment",
        },
        ...(route
          ? [
              {
                file: route.file,
                startLine: route.startLine,
                endLine: route.endLine,
                snippet: `${route.method} ${route.path}`,
                label: "Associated route without proof",
              },
            ]
          : []),
      ],
      remediation: {
        recommendedFix: generateRemediation(claim),
      },
      fingerprint: generateFingerprint(claim),
    });
  }

  return findings;
}

function findUnprovenCommentClaims(
  claims: IntentClaim[],
  proofTraces: Map<string, ProofTrace>,
  routes: RouteInfo[]
): IntentClaim[] {
  const unproven: IntentClaim[] = [];

  for (const claim of claims) {
    // Skip claims without route association for auth/validation
    if (
      (claim.type === "AUTH_ENFORCED" || claim.type === "INPUT_VALIDATED") &&
      !claim.targetRouteId
    ) {
      // Check if there are ANY routes in the file without proof
      const fileRoutes = routes.filter((r) => r.file === claim.location.file);
      for (const route of fileRoutes) {
        const proof = proofTraces.get(route.routeId);
        if (claim.type === "AUTH_ENFORCED" && proof && !proof.authProven && !proof.middlewareCovered) {
          unproven.push({ ...claim, targetRouteId: route.routeId });
        } else if (claim.type === "INPUT_VALIDATED" && proof && !proof.validationProven) {
          unproven.push({ ...claim, targetRouteId: route.routeId });
        }
      }
      continue;
    }

    if (!claim.targetRouteId) continue;

    const proof = proofTraces.get(claim.targetRouteId);
    if (!proof) {
      unproven.push(claim);
      continue;
    }

    // Check specific claim types
    if (claim.type === "AUTH_ENFORCED" && !proof.authProven && !proof.middlewareCovered) {
      unproven.push(claim);
    } else if (claim.type === "INPUT_VALIDATED" && !proof.validationProven) {
      unproven.push(claim);
    } else if (claim.type === "MIDDLEWARE_PROTECTED" && !proof.middlewareCovered) {
      unproven.push(claim);
    }
  }

  return unproven;
}

function formatClaimType(type: string): string {
  switch (type) {
    case "AUTH_ENFORCED":
      return "authentication";
    case "INPUT_VALIDATED":
      return "input validation";
    case "MIDDLEWARE_PROTECTED":
      return "middleware protection";
    case "CSRF_ENABLED":
      return "CSRF protection";
    case "RATE_LIMITED":
      return "rate limiting";
    default:
      return type.toLowerCase().replace(/_/g, " ");
  }
}

function generateDescription(
  claim: IntentClaim,
  route?: RouteInfo,
  trace?: ProofTrace
): string {
  let desc = `A comment claims that ${formatClaimType(claim.type)} is in place`;

  if (route) {
    desc += ` for the ${route.method} ${route.path} endpoint`;
  }

  desc += ", but static analysis couldn't verify this claim.";

  if (trace) {
    const missing: string[] = [];
    if (claim.type === "AUTH_ENFORCED" && !trace.authProven && !trace.middlewareCovered) {
      missing.push("authentication check");
    }
    if (claim.type === "INPUT_VALIDATED" && !trace.validationProven) {
      missing.push("validation usage");
    }
    if (claim.type === "MIDDLEWARE_PROTECTED" && !trace.middlewareCovered) {
      missing.push("middleware coverage");
    }

    if (missing.length > 0) {
      desc += ` Missing: ${missing.join(", ")}.`;
    }
  }

  desc += " This could be a documentation issue or missing implementation.";

  return desc;
}

function generateRemediation(claim: IntentClaim): string {
  switch (claim.type) {
    case "AUTH_ENFORCED":
      return "Add authentication check using getServerSession(), auth(), or similar before performing operations. Alternatively, update the comment if the claim is incorrect.";
    case "INPUT_VALIDATED":
      return "Add input validation using Zod, Yup, or Joi and ensure the validated result is used. Alternatively, update the comment if validation isn't needed.";
    case "MIDDLEWARE_PROTECTED":
      return "Ensure the middleware matcher covers this route, or add explicit auth check in the handler.";
    default:
      return "Verify the security claim matches the implementation, or update documentation to reflect actual behavior.";
  }
}

function generateFindingId(claim: IntentClaim): string {
  return `f-${crypto.randomUUID().slice(0, 8)}`;
}

function generateFingerprint(claim: IntentClaim): string {
  const data = `${RULE_ID}:${claim.location.file}:${claim.location.startLine}:${claim.type}`;
  return `sha256:${crypto.createHash("sha256").update(data).digest("hex")}`;
}

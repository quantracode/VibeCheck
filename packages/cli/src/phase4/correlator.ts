/**
 * Phase 4 Correlator - Post-Phase3 Correlation Pass
 *
 * This module runs after all phase3 scanners complete and correlates
 * findings across different scanner packs to identify complex patterns.
 *
 * Correlation rules:
 * - VC-CORR-001: Auth×Validation - state-changing route has auth but missing validation
 * - VC-CORR-002: Middleware×Upload - upload endpoints not covered by middleware
 * - VC-CORR-003: Network×Auth - token forwarded to outbound fetch without allowlist
 * - VC-CORR-004: Privacy×Logging - sensitive logging in authenticated context
 * - VC-CORR-005: Crypto×Auth - jwt.decode() used on auth gate paths
 * - VC-CORR-006: Hallucination×Coverage - comment claims protection but proof trace shows gap
 */

import type {
  Finding,
  CorrelationSummary,
  CorrelationPattern,
  RouteMap,
  MiddlewareMap,
  ProofTraceGraph,
  GraphNode,
  GraphEdge,
  EvidenceItem,
} from "@vibecheck/schema";
import { generateFingerprint, generateFindingId } from "../utils/fingerprint.js";

/**
 * Correlation context passed to the correlator
 */
export interface CorrelationContext {
  findings: Finding[];
  routeMap?: RouteMap;
  middlewareMap?: MiddlewareMap;
  proofTraces?: Record<string, {
    summary: string;
    nodes: Array<{ kind: string; label: string; file?: string; line?: number }>;
  }>;
  intentMap?: {
    intents: Array<{
      intentId: string;
      type: string;
      scope: string;
      targetRouteId?: string;
      source: string;
      location: { file: string; startLine: number; endLine: number };
      strength: string;
      textEvidence: string;
    }>;
  };
}

/**
 * Result of the correlation pass
 */
export interface CorrelationResult {
  /** Updated findings with correlation data */
  findings: Finding[];
  /** Correlation summary stats */
  correlationSummary: CorrelationSummary;
  /** Optional graph for visualization */
  graph?: ProofTraceGraph;
}

// =============================================================================
// Correlation Rule Implementations
// =============================================================================

/**
 * VC-CORR-001: Auth×Validation
 * State-changing route has auth evidence but missing server-side validation.
 *
 * Triggers when:
 * - Route has auth category findings (protected route)
 * - Route is state-changing (POST/PUT/PATCH/DELETE)
 * - No validation category findings for that route
 */
function detectAuthWithoutValidation(ctx: CorrelationContext): Finding[] {
  const correlatedFindings: Finding[] = [];

  // Group findings by file
  const findingsByFile = new Map<string, Finding[]>();
  for (const finding of ctx.findings) {
    const file = finding.evidence[0]?.file;
    if (file) {
      const existing = findingsByFile.get(file) || [];
      existing.push(finding);
      findingsByFile.set(file, existing);
    }
  }

  // Check routes for auth+validation gaps
  const routes = ctx.routeMap?.routes || [];
  const stateChangingMethods = ["POST", "PUT", "PATCH", "DELETE"];

  for (const route of routes) {
    if (!stateChangingMethods.includes(route.method)) continue;

    const fileFindings = findingsByFile.get(route.file) || [];
    const authFindings = fileFindings.filter(f => f.category === "auth");
    const validationFindings = fileFindings.filter(f => f.category === "validation");

    // If route file has auth issues but no validation issues, flag correlation
    if (authFindings.length > 0 && validationFindings.length === 0) {
      const relatedIds = authFindings.map(f => f.fingerprint);
      const evidence: EvidenceItem[] = [
        {
          file: route.file,
          startLine: route.startLine || 1,
          endLine: route.endLine || 1,
          label: `${route.method} ${route.path} - auth present, validation missing`,
        },
        ...authFindings[0].evidence,
      ];

      const fingerprint = generateFingerprint({
        ruleId: "VC-CORR-001",
        file: route.file,
        route: route.routeId,
        symbol: "auth_validation_gap",
      });

      correlatedFindings.push({
        id: generateFindingId({
          ruleId: "VC-CORR-001",
          file: route.file,
          symbol: route.routeId,
        }),
        severity: "medium",
        confidence: 0.75,
        category: "correlation",
        ruleId: "VC-CORR-001",
        title: "Auth Check Without Input Validation",
        description: `The ${route.method} ${route.path} endpoint has authentication checks but appears to be missing server-side input validation. Authenticated users can still submit malicious input. Related findings: ${relatedIds.join(", ")}`,
        evidence,
        remediation: {
          recommendedFix: `Add input validation using Zod, Yup, or Joi to validate request body/params before processing. Authentication prevents unauthorized access, but validation prevents malformed data.`,
        },
        fingerprint,
        correlationData: {
          relatedFindingIds: relatedIds,
          pattern: "auth_without_validation",
          explanation: `Route ${route.routeId} has auth checks (findings: ${relatedIds.length}) but no validation evidence.`,
        },
        relatedFindings: relatedIds,
      });
    }
  }

  return correlatedFindings;
}

/**
 * VC-CORR-002: Middleware×Upload
 * Upload endpoints not covered by middleware matcher.
 *
 * Triggers when:
 * - File has upload-related findings (VC-UPL-*)
 * - Middleware coverage shows route is uncovered
 */
function detectMiddlewareUploadGap(ctx: CorrelationContext): Finding[] {
  const correlatedFindings: Finding[] = [];

  if (!ctx.middlewareMap) return correlatedFindings;

  const middlewareMap = ctx.middlewareMap as MiddlewareMap;
  const uncoveredRoutes = middlewareMap.coverage?.filter(c => !c.covered) || [];

  // Find upload-related findings
  const uploadFindings = ctx.findings.filter(f =>
    f.ruleId.startsWith("VC-UPL") || f.category === "uploads"
  );

  for (const uncovered of uncoveredRoutes) {
    // Check if any upload findings are in this uncovered route
    const relatedUploads = uploadFindings.filter(f =>
      f.evidence.some(e => e.file.includes(uncovered.routeId) ||
        uncovered.routeId.includes(e.file.replace(/\\/g, "/")))
    );

    if (relatedUploads.length > 0) {
      const relatedIds = relatedUploads.map(f => f.fingerprint);
      const evidence: EvidenceItem[] = [
        {
          file: relatedUploads[0].evidence[0]?.file || uncovered.routeId,
          startLine: relatedUploads[0].evidence[0]?.startLine || 1,
          endLine: relatedUploads[0].evidence[0]?.endLine || 1,
          label: `Upload endpoint not protected by middleware`,
        },
      ];

      const fingerprint = generateFingerprint({
        ruleId: "VC-CORR-002",
        file: uncovered.routeId,
        symbol: "middleware_upload_gap",
      });

      correlatedFindings.push({
        id: generateFindingId({
          ruleId: "VC-CORR-002",
          file: uncovered.routeId,
          symbol: "upload",
        }),
        severity: "high",
        confidence: 0.8,
        category: "correlation",
        ruleId: "VC-CORR-002",
        title: "Upload Endpoint Not Protected by Middleware",
        description: `File upload endpoint at ${uncovered.routeId} is not covered by the global middleware. Upload endpoints without rate limiting or auth middleware are vulnerable to abuse. Related upload findings: ${relatedIds.join(", ")}`,
        evidence,
        remediation: {
          recommendedFix: `Extend middleware matcher to cover this upload endpoint, or add explicit rate limiting and auth checks in the handler. Consider: matcher: ['/((?!api/upload).*)'] to ensure coverage.`,
        },
        fingerprint,
        correlationData: {
          relatedFindingIds: relatedIds,
          pattern: "middleware_upload_gap",
          explanation: `Upload route ${uncovered.routeId} bypasses middleware (${uncovered.reason || "not in matcher"}).`,
        },
        relatedFindings: relatedIds,
      });
    }
  }

  return correlatedFindings;
}

/**
 * VC-CORR-003: Network×Auth
 * Token/session forwarded to outbound fetch without allowlist.
 *
 * Triggers when:
 * - File has network findings (VC-NET-* like SSRF)
 * - Same file has auth-related code (session, token variables)
 */
function detectNetworkAuthLeak(ctx: CorrelationContext): Finding[] {
  const correlatedFindings: Finding[] = [];

  // Find network-related findings (SSRF, missing timeout, etc.)
  const networkFindings = ctx.findings.filter(f =>
    f.ruleId.startsWith("VC-NET") || f.category === "network"
  );

  // Find auth-related findings
  const authFindings = ctx.findings.filter(f =>
    f.category === "auth" || f.category === "secrets"
  );

  // Group by file
  const networkByFile = new Map<string, Finding[]>();
  for (const f of networkFindings) {
    const file = f.evidence[0]?.file;
    if (file) {
      const existing = networkByFile.get(file) || [];
      existing.push(f);
      networkByFile.set(file, existing);
    }
  }

  const authByFile = new Map<string, Finding[]>();
  for (const f of authFindings) {
    const file = f.evidence[0]?.file;
    if (file) {
      const existing = authByFile.get(file) || [];
      existing.push(f);
      authByFile.set(file, existing);
    }
  }

  // Look for files with both network calls and auth/secrets
  for (const [file, netFindings] of networkByFile) {
    const fileAuthFindings = authByFile.get(file) || [];

    // Also check if network finding mentions token/auth in evidence
    const ssrfFindings = netFindings.filter(f =>
      f.ruleId === "VC-NET-001" || f.title.toLowerCase().includes("ssrf")
    );

    if (ssrfFindings.length > 0 && fileAuthFindings.length > 0) {
      const relatedIds = [...ssrfFindings, ...fileAuthFindings].map(f => f.fingerprint);
      const evidence: EvidenceItem[] = [
        ...ssrfFindings[0].evidence,
        ...(fileAuthFindings[0]?.evidence || []),
      ];

      const fingerprint = generateFingerprint({
        ruleId: "VC-CORR-003",
        file,
        symbol: "network_auth_leak",
      });

      correlatedFindings.push({
        id: generateFindingId({
          ruleId: "VC-CORR-003",
          file,
          symbol: "ssrf_token",
        }),
        severity: "critical",
        confidence: 0.7,
        category: "correlation",
        ruleId: "VC-CORR-003",
        title: "Token May Be Forwarded to User-Controlled URL",
        description: `File ${file} has both SSRF-prone fetch calls and authentication/token handling. Tokens or session data may be inadvertently forwarded to attacker-controlled servers. Related findings: ${relatedIds.join(", ")}`,
        evidence,
        remediation: {
          recommendedFix: `Never forward auth tokens to user-controlled URLs. Use an allowlist for external requests. Strip sensitive headers before forwarding requests. Consider using a separate HTTP client without default auth headers for user-provided URLs.`,
        },
        fingerprint,
        correlationData: {
          relatedFindingIds: relatedIds,
          pattern: "network_auth_leak",
          explanation: `File has SSRF vulnerability and handles auth tokens - risk of token exfiltration.`,
        },
        relatedFindings: relatedIds,
      });
    }
  }

  return correlatedFindings;
}

/**
 * VC-CORR-004: Privacy×Logging
 * Sensitive logging occurs in authenticated context (higher impact).
 *
 * Triggers when:
 * - File has privacy/logging findings (VC-PRIV-*)
 * - File is an API route (authenticated context likely)
 */
function detectPrivacyLoggingInAuth(ctx: CorrelationContext): Finding[] {
  const correlatedFindings: Finding[] = [];

  // Find privacy/logging findings
  const privacyFindings = ctx.findings.filter(f =>
    f.ruleId.startsWith("VC-PRIV") || f.category === "privacy"
  );

  // Get API route files from context
  const apiRouteFiles = new Set(
    (ctx.routeMap?.routes || []).map(r => r.file)
  );

  // Check privacy findings in API routes
  for (const privacyFinding of privacyFindings) {
    const file = privacyFinding.evidence[0]?.file;
    if (!file) continue;

    // Check if this file is an API route
    const isApiRoute = apiRouteFiles.has(file) ||
      file.includes("/api/") ||
      file.includes("route.ts") ||
      file.includes("route.js");

    if (isApiRoute) {
      const relatedIds = [privacyFinding.fingerprint];
      const evidence = [...privacyFinding.evidence];

      const fingerprint = generateFingerprint({
        ruleId: "VC-CORR-004",
        file,
        symbol: "privacy_auth_context",
        startLine: privacyFinding.evidence[0]?.startLine,
      });

      correlatedFindings.push({
        id: generateFindingId({
          ruleId: "VC-CORR-004",
          file,
          symbol: "sensitive_log_api",
          startLine: privacyFinding.evidence[0]?.startLine,
        }),
        severity: "high",
        confidence: 0.8,
        category: "correlation",
        ruleId: "VC-CORR-004",
        title: "Sensitive Logging in Authenticated API Context",
        description: `Sensitive data logging in ${file} occurs in an API route context. This increases impact as authenticated user data (tokens, sessions, PII) may be exposed in logs. Related finding: ${privacyFinding.fingerprint}`,
        evidence,
        remediation: {
          recommendedFix: `Remove sensitive data from logs in API routes. Log only non-sensitive identifiers (user ID, request ID, timestamps). Use structured logging with explicit field allowlists.`,
        },
        fingerprint,
        correlationData: {
          relatedFindingIds: relatedIds,
          pattern: "privacy_auth_context",
          explanation: `Privacy finding in API route context increases data exposure risk.`,
        },
        relatedFindings: relatedIds,
      });
    }
  }

  return correlatedFindings;
}

/**
 * VC-CORR-005: Crypto×Auth
 * jwt.decode() used on auth gate paths.
 *
 * Triggers when:
 * - File has crypto findings for JWT decode without verify (VC-CRYPTO-002)
 * - File is an API route or auth-related file
 */
function detectCryptoAuthGate(ctx: CorrelationContext): Finding[] {
  const correlatedFindings: Finding[] = [];

  // Find JWT decode findings
  const jwtFindings = ctx.findings.filter(f =>
    f.ruleId === "VC-CRYPTO-002" ||
    f.title.toLowerCase().includes("jwt") && f.title.toLowerCase().includes("decode")
  );

  // Get API route files and auth-related files
  const apiRouteFiles = new Set(
    (ctx.routeMap?.routes || []).map(r => r.file)
  );

  for (const jwtFinding of jwtFindings) {
    const file = jwtFinding.evidence[0]?.file;
    if (!file) continue;

    // Check if this is in auth context
    const isAuthContext = apiRouteFiles.has(file) ||
      file.includes("/api/") ||
      file.includes("auth") ||
      file.includes("middleware") ||
      file.includes("session");

    if (isAuthContext) {
      const relatedIds = [jwtFinding.fingerprint];
      const evidence = [...jwtFinding.evidence];

      const fingerprint = generateFingerprint({
        ruleId: "VC-CORR-005",
        file,
        symbol: "jwt_auth_gate",
        startLine: jwtFinding.evidence[0]?.startLine,
      });

      correlatedFindings.push({
        id: generateFindingId({
          ruleId: "VC-CORR-005",
          file,
          symbol: "jwt_gate",
          startLine: jwtFinding.evidence[0]?.startLine,
        }),
        severity: "critical",
        confidence: 0.85,
        category: "correlation",
        ruleId: "VC-CORR-005",
        title: "JWT Decode Without Verify on Auth Gate Path",
        description: `jwt.decode() without verification is used in ${file}, which appears to be an authentication/authorization gate. This allows attackers to forge JWT tokens and bypass auth entirely. Related finding: ${jwtFinding.fingerprint}`,
        evidence,
        remediation: {
          recommendedFix: `Replace jwt.decode() with jwt.verify() in auth gate paths. Never trust JWT claims without signature verification. If you need to read claims before verification (e.g., to get 'kid'), verify immediately after.`,
        },
        fingerprint,
        correlationData: {
          relatedFindingIds: relatedIds,
          pattern: "crypto_auth_gate",
          explanation: `JWT decode without verify in auth gate path allows token forgery.`,
        },
        relatedFindings: relatedIds,
      });
    }
  }

  return correlatedFindings;
}

/**
 * VC-CORR-006: Hallucination×Coverage
 * Comment claims protection but proof trace shows gap.
 *
 * Triggers when:
 * - File has hallucination findings (VC-HALL-*)
 * - Route's proof trace shows protection gap
 */
function detectHallucinationCoverageGap(ctx: CorrelationContext): Finding[] {
  const correlatedFindings: Finding[] = [];

  // Find hallucination findings (security theater)
  const hallFindings = ctx.findings.filter(f =>
    f.ruleId.startsWith("VC-HALL") || f.category === "hallucinations"
  );

  // Check proof traces for gaps
  const proofTraces = ctx.proofTraces || {};

  for (const hallFinding of hallFindings) {
    const file = hallFinding.evidence[0]?.file;
    if (!file) continue;

    // Find routes in this file
    const fileRoutes = (ctx.routeMap?.routes || []).filter(r => r.file === file);

    for (const route of fileRoutes) {
      const trace = proofTraces[route.routeId];

      // Check if trace shows protection gap
      if (trace && trace.summary.includes("No protection proven")) {
        const relatedIds = [hallFinding.fingerprint];
        const evidence: EvidenceItem[] = [
          ...hallFinding.evidence,
          {
            file: route.file,
            startLine: route.startLine || 1,
            endLine: route.endLine || 1,
            label: `Route ${route.method} ${route.path} - proof trace shows no protection`,
          },
        ];

        const fingerprint = generateFingerprint({
          ruleId: "VC-CORR-006",
          file,
          route: route.routeId,
          symbol: "hallucination_coverage",
        });

        correlatedFindings.push({
          id: generateFindingId({
            ruleId: "VC-CORR-006",
            file,
            symbol: route.routeId,
          }),
          severity: "high",
          confidence: 0.8,
          category: "correlation",
          ruleId: "VC-CORR-006",
          title: "Security Claim Contradicts Proof Trace",
          description: `Comments or imports in ${file} claim security protection, but the proof trace for ${route.method} ${route.path} shows no actual protection. This is a dangerous hallucination that creates false confidence. Related finding: ${hallFinding.fingerprint}`,
          evidence,
          remediation: {
            recommendedFix: `Either implement the claimed security control (auth check, validation, etc.) or remove misleading comments/imports. Proof traces require actual runtime checks to prove protection.`,
          },
          fingerprint,
          correlationData: {
            relatedFindingIds: relatedIds,
            pattern: "hallucination_coverage_gap",
            explanation: `Hallucination finding + proof trace gap = false security confidence.`,
          },
          relatedFindings: relatedIds,
        });
      }
    }
  }

  return correlatedFindings;
}

// =============================================================================
// Graph Building
// =============================================================================

/**
 * Build a proof trace graph from findings and routes
 */
function buildGraph(ctx: CorrelationContext, correlatedFindings: Finding[]): ProofTraceGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeIds = new Set<string>();

  // Add route nodes
  if (ctx.routeMap?.routes) {
    for (const route of ctx.routeMap.routes) {
      if (!nodeIds.has(route.routeId)) {
        nodes.push({
          id: route.routeId,
          type: "route",
          label: `${route.method} ${route.path}`,
          file: route.file,
          line: route.startLine,
        });
        nodeIds.add(route.routeId);
      }
    }
  }

  // Add finding nodes and edges
  for (const finding of [...ctx.findings, ...correlatedFindings]) {
    const nodeId = `finding-${finding.fingerprint.slice(0, 16)}`;
    if (!nodeIds.has(nodeId)) {
      nodes.push({
        id: nodeId,
        type: "finding",
        label: finding.title,
        file: finding.evidence[0]?.file,
        line: finding.evidence[0]?.startLine,
        metadata: { severity: finding.severity, category: finding.category },
      });
      nodeIds.add(nodeId);
    }

    // Add edges for related findings
    if (finding.relatedFindings) {
      for (const relatedId of finding.relatedFindings) {
        const relatedNodeId = `finding-${relatedId.slice(0, 16)}`;
        edges.push({
          source: nodeId,
          target: relatedNodeId,
          type: "correlates",
          label: finding.correlationData?.pattern,
        });
      }
    }
  }

  return { nodes, edges };
}

// =============================================================================
// Main Correlation Pass
// =============================================================================

/**
 * Run the correlation pass on findings
 *
 * This should be called after all phase3 scanners complete,
 * before writing the artifact.
 */
export function runCorrelationPass(ctx: CorrelationContext): CorrelationResult {
  const startTime = Date.now();

  // Run all correlation detectors
  const correlatedFindings: Finding[] = [
    ...detectAuthWithoutValidation(ctx),
    ...detectMiddlewareUploadGap(ctx),
    ...detectNetworkAuthLeak(ctx),
    ...detectPrivacyLoggingInAuth(ctx),
    ...detectCryptoAuthGate(ctx),
    ...detectHallucinationCoverageGap(ctx),
  ];

  // Sort for determinism: by ruleId, then file, then line
  correlatedFindings.sort((a, b) => {
    const ruleCompare = a.ruleId.localeCompare(b.ruleId);
    if (ruleCompare !== 0) return ruleCompare;

    const fileA = a.evidence[0]?.file || "";
    const fileB = b.evidence[0]?.file || "";
    const fileCompare = fileA.localeCompare(fileB);
    if (fileCompare !== 0) return fileCompare;

    const lineA = a.evidence[0]?.startLine || 0;
    const lineB = b.evidence[0]?.startLine || 0;
    return lineA - lineB;
  });

  // Build pattern counts
  const byPattern: Record<string, number> = {};
  for (const finding of correlatedFindings) {
    const pattern = finding.correlationData?.pattern;
    if (pattern) {
      byPattern[pattern] = (byPattern[pattern] || 0) + 1;
    }
  }

  // Merge correlated findings with original findings
  const allFindings = [...ctx.findings, ...correlatedFindings];

  // Build the graph
  const graph = buildGraph(ctx, correlatedFindings);

  const correlationSummary: CorrelationSummary = {
    totalCorrelations: correlatedFindings.length,
    byPattern,
    correlationDurationMs: Date.now() - startTime,
  };

  return {
    findings: allFindings,
    correlationSummary,
    graph,
  };
}

/**
 * Check if correlation pass should run
 * Only runs if there are findings to correlate
 */
export function shouldRunCorrelation(findings: Finding[]): boolean {
  return findings.length > 0;
}

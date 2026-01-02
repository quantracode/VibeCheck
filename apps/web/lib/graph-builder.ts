/**
 * Graph Builder for Visual Application Map
 *
 * Builds a graph representation from scan artifact data
 * for visualization of security architecture.
 */

import type {
  ScanArtifact,
  Finding,
  RouteEntry,
  IntentEntry,
  Severity,
} from "@vibecheck/schema";

// ============================================================================
// Types
// ============================================================================

export type NodeType =
  | "route"
  | "file"
  | "middleware"
  | "database"
  | "external"
  | "config";

export type EdgeType =
  | "import"
  | "call"
  | "middleware"
  | "db_access"
  | "external_call";

export type RiskLevel = "none" | "low" | "medium" | "high" | "critical";

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  risk: RiskLevel;
  /** File path for file nodes */
  file?: string;
  /** HTTP method for route nodes */
  method?: string;
  /** URL path for route nodes */
  path?: string;
  /** Line number in file */
  line?: number;
  /** Number of findings associated */
  findingCount: number;
  /** Severity counts */
  severityCounts: Record<Severity, number>;
  /** Has auth protection */
  hasAuth: boolean;
  /** Has validation */
  hasValidation: boolean;
  /** Has rate limiting */
  hasRateLimit: boolean;
  /** Is covered by middleware */
  middlewareCovered: boolean;
  /** Associated findings IDs */
  findingIds: string[];
  /** Associated intent IDs */
  intentIds: string[];
  /** Position for layout */
  x?: number;
  y?: number;
  /** Size based on importance */
  size: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
  /** Edge weight for layout */
  weight: number;
}

export interface ApplicationGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Metadata about the graph */
  meta: {
    totalRoutes: number;
    totalFiles: number;
    totalFindings: number;
    riskScore: number;
    coverageScore: number;
  };
}

// ============================================================================
// Risk Calculation
// ============================================================================

const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 10,
  high: 5,
  medium: 2,
  low: 1,
  info: 0,
};

function calculateRiskLevel(severityCounts: Record<Severity, number>): RiskLevel {
  if (severityCounts.critical > 0) return "critical";
  if (severityCounts.high > 0) return "high";
  if (severityCounts.medium > 0) return "medium";
  if (severityCounts.low > 0) return "low";
  return "none";
}

function calculateRiskScore(findings: Finding[]): number {
  return findings.reduce((sum, f) => sum + SEVERITY_WEIGHTS[f.severity], 0);
}

// ============================================================================
// Graph Building
// ============================================================================

/**
 * Extract file path from evidence
 */
function getFileFromEvidence(finding: Finding): string | null {
  return finding.evidence[0]?.file ?? null;
}

/**
 * Normalize file path for consistent node IDs
 */
function normalizeFilePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * Generate node ID for a file
 */
function fileNodeId(file: string): string {
  return `file:${normalizeFilePath(file)}`;
}

/**
 * Generate node ID for a route
 */
function routeNodeId(method: string, path: string): string {
  return `route:${method}:${path}`;
}

/**
 * Get routes from artifact (handles both legacy and new format)
 */
function getRoutes(artifact: ScanArtifact): RouteEntry[] {
  if (!artifact.routeMap) return [];
  if (Array.isArray(artifact.routeMap)) return artifact.routeMap;
  return artifact.routeMap.routes ?? [];
}

/**
 * Get intents from artifact
 */
function getIntents(artifact: ScanArtifact): IntentEntry[] {
  return artifact.intentMap?.intents ?? [];
}

/**
 * Get middleware coverage status for a route
 */
function getMiddlewareCoverage(
  artifact: ScanArtifact,
  routeId: string
): boolean {
  if (!artifact.middlewareMap) return false;
  if (Array.isArray(artifact.middlewareMap)) return false;

  const coverage = artifact.middlewareMap.coverage?.find(
    (c) => c.routeId === routeId
  );
  return coverage?.covered ?? false;
}

/**
 * Check if a finding indicates auth protection
 */
function hasAuthFromFindings(findings: Finding[]): boolean {
  // If there are auth-related findings, auth is likely missing
  const authFindings = findings.filter(
    (f) => f.category === "auth" || f.ruleId.startsWith("VC-AUTH")
  );
  return authFindings.length === 0;
}

/**
 * Check if a finding indicates validation
 */
function hasValidationFromFindings(findings: Finding[]): boolean {
  const valFindings = findings.filter(
    (f) => f.category === "validation" || f.ruleId.startsWith("VC-VAL")
  );
  return valFindings.length === 0;
}

/**
 * Build the application graph from a scan artifact
 */
export function buildApplicationGraph(artifact: ScanArtifact): ApplicationGraph {
  const nodes: Map<string, GraphNode> = new Map();
  const edges: GraphEdge[] = [];
  const findings = artifact.findings;
  const routes = getRoutes(artifact);
  const intents = getIntents(artifact);

  // Track files with findings
  const fileFindings = new Map<string, Finding[]>();
  const fileSeverities = new Map<string, Record<Severity, number>>();

  // Group findings by file
  for (const finding of findings) {
    const file = getFileFromEvidence(finding);
    if (!file) continue;

    const normalized = normalizeFilePath(file);
    if (!fileFindings.has(normalized)) {
      fileFindings.set(normalized, []);
      fileSeverities.set(normalized, {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      });
    }
    fileFindings.get(normalized)!.push(finding);
    fileSeverities.get(normalized)![finding.severity]++;
  }

  // Create route nodes
  for (const route of routes) {
    const nodeId = routeNodeId(route.method, route.path);
    const file = normalizeFilePath(route.file);
    const routeFindings = fileFindings.get(file) ?? [];
    const severityCounts = fileSeverities.get(file) ?? {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    // Find intents for this route
    const routeIntents = intents.filter((i) => i.targetRouteId === route.routeId);

    nodes.set(nodeId, {
      id: nodeId,
      label: `${route.method} ${route.path}`,
      type: "route",
      risk: calculateRiskLevel(severityCounts),
      file: route.file,
      method: route.method,
      path: route.path,
      line: route.startLine,
      findingCount: routeFindings.length,
      severityCounts,
      hasAuth: hasAuthFromFindings(routeFindings),
      hasValidation: hasValidationFromFindings(routeFindings),
      hasRateLimit: !routeFindings.some((f) => f.ruleId === "VC-RATE-001"),
      middlewareCovered: getMiddlewareCoverage(artifact, route.routeId),
      findingIds: routeFindings.map((f) => f.id),
      intentIds: routeIntents.map((i) => i.intentId),
      size: Math.max(20, Math.min(50, 20 + routeFindings.length * 5)),
    });

    // Create file node if not exists
    const fileNodeID = fileNodeId(file);
    if (!nodes.has(fileNodeID)) {
      nodes.set(fileNodeID, {
        id: fileNodeID,
        label: file.split("/").pop() ?? file,
        type: "file",
        risk: calculateRiskLevel(severityCounts),
        file: route.file,
        findingCount: routeFindings.length,
        severityCounts,
        hasAuth: false,
        hasValidation: false,
        hasRateLimit: false,
        middlewareCovered: false,
        findingIds: routeFindings.map((f) => f.id),
        intentIds: [],
        size: 15,
      });
    }

    // Create edge from file to route
    edges.push({
      id: `${fileNodeID}->${nodeId}`,
      source: fileNodeID,
      target: nodeId,
      type: "call",
      weight: 1,
    });
  }

  // Add middleware node if present
  if (artifact.middlewareMap) {
    const mwFile = Array.isArray(artifact.middlewareMap)
      ? artifact.middlewareMap[0]?.file
      : artifact.middlewareMap.middlewareFile;

    if (mwFile) {
      const mwNodeId = "middleware:global";
      nodes.set(mwNodeId, {
        id: mwNodeId,
        label: "Middleware",
        type: "middleware",
        risk: "none",
        file: mwFile,
        findingCount: 0,
        severityCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        hasAuth: true,
        hasValidation: false,
        hasRateLimit: false,
        middlewareCovered: true,
        findingIds: [],
        intentIds: [],
        size: 35,
      });

      // Connect middleware to covered routes
      for (const [nodeId, node] of nodes) {
        if (node.type === "route" && node.middlewareCovered) {
          edges.push({
            id: `${mwNodeId}->${nodeId}`,
            source: mwNodeId,
            target: nodeId,
            type: "middleware",
            label: "protects",
            weight: 0.5,
          });
        }
      }
    }
  }

  // Identify database access patterns from findings
  const dbFindings = findings.filter(
    (f) =>
      f.evidence.some((e) => e.snippet?.includes("prisma")) ||
      f.description.toLowerCase().includes("database")
  );

  if (dbFindings.length > 0) {
    const dbNodeId = "database:prisma";
    nodes.set(dbNodeId, {
      id: dbNodeId,
      label: "Database (Prisma)",
      type: "database",
      risk: "none",
      findingCount: 0,
      severityCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      hasAuth: false,
      hasValidation: false,
      hasRateLimit: false,
      middlewareCovered: false,
      findingIds: [],
      intentIds: [],
      size: 40,
    });

    // Connect files with DB access
    const filesWithDb = new Set<string>();
    for (const finding of dbFindings) {
      const file = getFileFromEvidence(finding);
      if (file) filesWithDb.add(normalizeFilePath(file));
    }

    for (const file of filesWithDb) {
      const fileNode = fileNodeId(file);
      if (nodes.has(fileNode)) {
        edges.push({
          id: `${fileNode}->${dbNodeId}`,
          source: fileNode,
          target: dbNodeId,
          type: "db_access",
          weight: 1,
        });
      }
    }
  }

  // Calculate metadata
  const nodeArray = Array.from(nodes.values());
  const routeNodes = nodeArray.filter((n) => n.type === "route");
  const fileNodes = nodeArray.filter((n) => n.type === "file");
  const riskScore = calculateRiskScore(findings);
  const protectedRoutes = routeNodes.filter(
    (n) => n.hasAuth || n.middlewareCovered
  ).length;
  const coverageScore =
    routeNodes.length > 0 ? (protectedRoutes / routeNodes.length) * 100 : 100;

  return {
    nodes: nodeArray,
    edges,
    meta: {
      totalRoutes: routeNodes.length,
      totalFiles: fileNodes.length,
      totalFindings: findings.length,
      riskScore,
      coverageScore: Math.round(coverageScore),
    },
  };
}

// ============================================================================
// Layout Algorithms
// ============================================================================

/**
 * Apply force-directed layout to graph
 * Simple implementation for client-side rendering
 */
export function applyForceLayout(
  graph: ApplicationGraph,
  width: number,
  height: number,
  iterations = 100
): ApplicationGraph {
  const nodes = [...graph.nodes];
  const edges = graph.edges;

  // Initialize positions
  const centerX = width / 2;
  const centerY = height / 2;

  // Position nodes by type in layers
  const typePositions: Record<NodeType, { x: number; y: number }> = {
    middleware: { x: centerX, y: 50 },
    route: { x: centerX, y: height * 0.35 },
    file: { x: centerX, y: height * 0.6 },
    database: { x: centerX, y: height * 0.85 },
    external: { x: width * 0.85, y: centerY },
    config: { x: width * 0.15, y: centerY },
  };

  // Group nodes by type
  const nodesByType = new Map<NodeType, GraphNode[]>();
  for (const node of nodes) {
    if (!nodesByType.has(node.type)) {
      nodesByType.set(node.type, []);
    }
    nodesByType.get(node.type)!.push(node);
  }

  // Position nodes in each type group
  for (const [type, typeNodes] of nodesByType) {
    const basePos = typePositions[type];
    const count = typeNodes.length;
    const spread = Math.min(width * 0.8, count * 100);

    typeNodes.forEach((node, i) => {
      const offset = count > 1 ? (i / (count - 1) - 0.5) * spread : 0;
      node.x = basePos.x + offset;
      node.y = basePos.y + (Math.random() - 0.5) * 30;
    });
  }

  // Simple force simulation
  const repulsion = 5000;
  const attraction = 0.01;
  const damping = 0.9;

  const velocities = new Map<string, { vx: number; vy: number }>();
  nodes.forEach((n) => velocities.set(n.id, { vx: 0, vy: 0 }));

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = (b.x ?? 0) - (a.x ?? 0);
        const dy = (b.y ?? 0) - (a.y ?? 0);
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = repulsion / (dist * dist);

        const vA = velocities.get(a.id)!;
        const vB = velocities.get(b.id)!;
        vA.vx -= (dx / dist) * force;
        vA.vy -= (dy / dist) * force;
        vB.vx += (dx / dist) * force;
        vB.vy += (dy / dist) * force;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const source = nodes.find((n) => n.id === edge.source);
      const target = nodes.find((n) => n.id === edge.target);
      if (!source || !target) continue;

      const dx = (target.x ?? 0) - (source.x ?? 0);
      const dy = (target.y ?? 0) - (source.y ?? 0);
      const force = attraction * edge.weight;

      const vS = velocities.get(source.id)!;
      const vT = velocities.get(target.id)!;
      vS.vx += dx * force;
      vS.vy += dy * force;
      vT.vx -= dx * force;
      vT.vy -= dy * force;
    }

    // Apply velocities with damping and bounds
    for (const node of nodes) {
      const v = velocities.get(node.id)!;
      v.vx *= damping;
      v.vy *= damping;

      node.x = Math.max(50, Math.min(width - 50, (node.x ?? centerX) + v.vx));
      node.y = Math.max(50, Math.min(height - 50, (node.y ?? centerY) + v.vy));
    }
  }

  return { ...graph, nodes };
}

// ============================================================================
// Best Practice Architecture
// ============================================================================

export interface BestPracticeNode {
  id: string;
  label: string;
  type: NodeType;
  description: string;
  required: boolean;
}

export interface BestPracticeEdge {
  source: string;
  target: string;
  label: string;
}

export interface BestPracticeArchitecture {
  nodes: BestPracticeNode[];
  edges: BestPracticeEdge[];
  title: string;
  description: string;
}

export const BEST_PRACTICE_ARCHITECTURE: BestPracticeArchitecture = {
  title: "Secure API Architecture",
  description:
    "Recommended security architecture for Next.js API routes with proper layered protection.",
  nodes: [
    {
      id: "bp:client",
      label: "Client",
      type: "external",
      description: "Browser or mobile client making requests",
      required: true,
    },
    {
      id: "bp:middleware",
      label: "Auth Middleware",
      type: "middleware",
      description:
        "Global middleware for authentication, rate limiting, and request validation",
      required: true,
    },
    {
      id: "bp:routes",
      label: "API Routes",
      type: "route",
      description:
        "Route handlers with input validation and authorization checks",
      required: true,
    },
    {
      id: "bp:services",
      label: "Service Layer",
      type: "file",
      description: "Business logic separated from route handlers",
      required: false,
    },
    {
      id: "bp:db",
      label: "Database",
      type: "database",
      description: "Data persistence with parameterized queries",
      required: true,
    },
    {
      id: "bp:external",
      label: "External APIs",
      type: "external",
      description: "Third-party services with timeout and error handling",
      required: false,
    },
  ],
  edges: [
    { source: "bp:client", target: "bp:middleware", label: "request" },
    { source: "bp:middleware", target: "bp:routes", label: "validated" },
    { source: "bp:routes", target: "bp:services", label: "business logic" },
    { source: "bp:services", target: "bp:db", label: "data access" },
    { source: "bp:services", target: "bp:external", label: "API calls" },
  ],
};

// ============================================================================
// Gap Analysis
// ============================================================================

export interface SecurityGap {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  affectedNodes: string[];
  recommendation: string;
}

/**
 * Analyze security gaps between actual and best practice architecture
 */
export function analyzeSecurityGaps(graph: ApplicationGraph): SecurityGap[] {
  const gaps: SecurityGap[] = [];
  const routeNodes = graph.nodes.filter((n) => n.type === "route");
  const hasMiddleware = graph.nodes.some((n) => n.type === "middleware");

  // Check for missing middleware
  if (!hasMiddleware && routeNodes.length > 0) {
    gaps.push({
      id: "gap:no-middleware",
      severity: "high",
      title: "No Global Middleware",
      description:
        "Application lacks global middleware for authentication and rate limiting.",
      affectedNodes: routeNodes.map((n) => n.id),
      recommendation:
        "Add middleware.ts with auth checks and rate limiting for API routes.",
    });
  }

  // Check for unprotected routes
  const unprotectedRoutes = routeNodes.filter(
    (n) => !n.hasAuth && !n.middlewareCovered
  );
  if (unprotectedRoutes.length > 0) {
    gaps.push({
      id: "gap:unprotected-routes",
      severity: "critical",
      title: "Unprotected API Routes",
      description: `${unprotectedRoutes.length} route(s) lack authentication or middleware protection.`,
      affectedNodes: unprotectedRoutes.map((n) => n.id),
      recommendation:
        "Add authentication checks or extend middleware coverage to these routes.",
    });
  }

  // Check for missing validation
  const noValidation = routeNodes.filter(
    (n) => !n.hasValidation && n.method !== "GET"
  );
  if (noValidation.length > 0) {
    gaps.push({
      id: "gap:no-validation",
      severity: "high",
      title: "Missing Input Validation",
      description: `${noValidation.length} state-changing route(s) lack input validation.`,
      affectedNodes: noValidation.map((n) => n.id),
      recommendation: "Add Zod or similar validation for all POST/PUT/DELETE routes.",
    });
  }

  // Check for missing rate limiting
  const noRateLimit = routeNodes.filter((n) => !n.hasRateLimit);
  if (noRateLimit.length > 3) {
    gaps.push({
      id: "gap:no-rate-limit",
      severity: "medium",
      title: "Limited Rate Limiting",
      description: `${noRateLimit.length} route(s) lack rate limiting protection.`,
      affectedNodes: noRateLimit.map((n) => n.id),
      recommendation:
        "Implement rate limiting via middleware or per-route to prevent abuse.",
    });
  }

  // Check for high-risk nodes
  const criticalNodes = graph.nodes.filter((n) => n.risk === "critical");
  if (criticalNodes.length > 0) {
    gaps.push({
      id: "gap:critical-findings",
      severity: "critical",
      title: "Critical Security Findings",
      description: `${criticalNodes.length} component(s) have critical security findings.`,
      affectedNodes: criticalNodes.map((n) => n.id),
      recommendation: "Address critical findings immediately before deployment.",
    });
  }

  return gaps;
}
